"""
PDF Toolbox Backend API
-----------------------
This is the FastAPI backend service for the PDF Toolbox application.
It provides RESTful APIs for:
1. Merging multiple PDFs into one document.
2. Converting Images and Office documents (Word, Excel, PPT) to PDF.
3. Extracting specific pages from a PDF.
"""
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfWriter, PdfReader
from pypdf.errors import PdfReadError
from PIL import Image, UnidentifiedImageError
import os
import io
import tempfile

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Hello, PDF Toolbox backend is running successfully!"}

# 1. Merge PDF Endpoint
@app.post("/merge/")
def merge_pdfs(files: list[UploadFile] = File(...)):
    merger = PdfWriter()
    try:
        for file in files:
            # 简单的后缀名校验
            if not file.filename.lower().endswith('.pdf'):
                raise HTTPException(status_code=400, detail=f"'{file.filename}' is not a valid PDF.")
            merger.append(file.file)
            
        output_pdf = io.BytesIO()
        merger.write(output_pdf)
        merger.close()
        
        return Response(
            content=output_pdf.getvalue(),
            media_type="application/pdf", 
            headers={"Content-Disposition": "attachment; filename=Merged_Document.pdf"}
        )
    except PdfReadError:
        raise HTTPException(status_code=400, detail="One or more PDF files are corrupted or unreadable.")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal error during merging.")

# 2. Universal File to PDF Endpoint
@app.post("/convert/")
def convert_file_to_pdf(file: UploadFile = File(...)):
    try:
        ext = file.filename.split('.')[-1].lower()
        original_name = file.filename.rsplit('.', 1)[0]
        output_filename = f"converted_{original_name}.pdf"

        # --- 支持的图片格式拓展 ---
        if ext in ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'tiff', 'gif']:
            image = Image.open(file.file)
            if image.mode in ("RGBA", "P"):
                image = image.convert('RGB')
            else:
                image = image.convert('RGB')
                
            output_pdf = io.BytesIO()
            image.save(output_pdf, format="PDF")
            
            return Response(
                content=output_pdf.getvalue(),
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={output_filename}"}
            )
            
        # --- 支持 Office 全家桶 (Word, Excel, PPT) 转换 ---
        elif ext in ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt']:
            # Office 转换必须落地到硬盘，且路径必须是绝对路径
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp_in:
                tmp_in.write(file.file.read())
                tmp_in_path = os.path.abspath(tmp_in.name)
            
            tmp_out_path = tmp_in_path.replace(".docx", ".pdf")
            tmp_out_path = os.path.abspath(tmp_in_path.rsplit('.', 1)[0] + ".pdf")
            
            try:
                if ext in ['docx', 'doc']:
                    from docx2pdf import convert as docx_convert
                    docx_convert(tmp_in_path, tmp_out_path)
                    
                elif ext in ['xlsx', 'xls']:
                    import pythoncom
                    import win32com.client
                    pythoncom.CoInitialize() # 在多线程中调用 Windows COM 必须初始化
                    try:
                        excel = win32com.client.Dispatch("Excel.Application")
                        excel.Visible = False
                        wb = excel.Workbooks.Open(tmp_in_path)
                        wb.ExportAsFixedFormat(0, tmp_out_path) # 0 代表 xlTypePDF
                        wb.Close(False)
                        excel.Quit()
                    finally:
                        pythoncom.CoUninitialize()
                        
                elif ext in ['pptx', 'ppt']:
                    import pythoncom
                    import win32com.client
                    pythoncom.CoInitialize()
                    try:
                        powerpoint = win32com.client.Dispatch("Powerpoint.Application")
                        presentation = powerpoint.Presentations.Open(tmp_in_path, WithWindow=False)
                        presentation.SaveAs(tmp_out_path, 32) # 32 代表 ppSaveAsPDF
                        presentation.Close()
                        powerpoint.Quit()
                    finally:
                        pythoncom.CoUninitialize()

                # 读取生成的 PDF
                with open(tmp_out_path, "rb") as f:
                    pdf_data = f.read()
            finally:
                # 使用 finally 确保无论转换成功还是报错，临时文件都会被清理
                if os.path.exists(tmp_in_path): os.remove(tmp_in_path)
                if os.path.exists(tmp_out_path): os.remove(tmp_out_path)

            return Response(
                content=pdf_data,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={output_filename}"}
            )
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file format: .{ext}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")

# 3. Extract PDF Pages Endpoint
@app.post("/extract/")
def extract_pdf_pages(file: UploadFile = File(...), pages: str = Form(...)):
    try:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Uploaded file is not a valid PDF.")
        
        reader = PdfReader(file.file)
        writer = PdfWriter()
        total_pages = len(reader.pages)
        
        # 解析用户输入的页码 (例如: "1, 3, 5-7")
        page_indices = set()
        for part in pages.split(','):
            part = part.strip()
            if not part:
                continue
            if '-' in part:
                start_str, end_str = part.split('-')
                start, end = int(start_str.strip()), int(end_str.strip())
                if start > end:
                    start, end = end, start  # 纠正大小顺序
                for i in range(start, end + 1):
                    page_indices.add(i)
            else:
                page_indices.add(int(part))
        
        sorted_pages = sorted(list(page_indices))
        if not sorted_pages:
            raise HTTPException(status_code=400, detail="No valid pages specified.")

        for p in sorted_pages:
            idx = p - 1 # 用户输入的是 1-based 页码，我们需要转换为 0-based 索引
            if 0 <= idx < total_pages:
                writer.add_page(reader.pages[idx])
            else:
                raise HTTPException(status_code=400, detail=f"Page {p} is out of range. The PDF only has {total_pages} pages.")
        
        output_pdf = io.BytesIO()
        writer.write(output_pdf)
        writer.close()
        
        original_name = file.filename.split('.')[0]
        output_filename = f"extracted_{original_name}.pdf"

        return Response(
            content=output_pdf.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={output_filename}"}
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page format. Please use numbers, commas, and dashes (e.g., 1,3,5-7).")
    except PdfReadError:
        raise HTTPException(status_code=400, detail="The PDF file is corrupted or unreadable.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal error during extraction.")
    