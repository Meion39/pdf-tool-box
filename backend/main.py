"""
PDF Toolbox Backend API
-----------------------
This is the FastAPI backend service for the PDF Toolbox application.
It provides RESTful APIs for:
1. Merging multiple PDFs into one document.
2. Converting Images to PDF.
3. Extracting specific pages from a PDF.
"""
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfWriter, PdfReader
from pypdf.errors import PdfReadError
from PIL import Image, UnidentifiedImageError
import os
import io

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
            # Simple file extension validation
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

# 2. Image to PDF Endpoint
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
        
        # Parse user-input page string (e.g., "1, 3, 5-7")
        page_indices = set()
        for part in pages.split(','):
            part = part.strip()
            if not part:
                continue
            if '-' in part:
                start_str, end_str = part.split('-')
                start, end = int(start_str.strip()), int(end_str.strip())
                if start > end:
                    start, end = end, start  # Correct the order if start > end
                for i in range(start, end + 1):
                    page_indices.add(i)
            else:
                page_indices.add(int(part))
        
        sorted_pages = sorted(list(page_indices))
        if not sorted_pages:
            raise HTTPException(status_code=400, detail="No valid pages specified.")

        for p in sorted_pages:
            idx = p - 1 # User input is 1-based, convert to 0-based index
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
    