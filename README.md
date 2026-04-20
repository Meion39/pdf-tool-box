# 📄 My PDF Toolbox

A modern, fast, and fully functional full-stack web application for PDF processing.

## ✨ Features

- **Merge PDFs**: Drag and drop multiple PDF files, reorder them, and merge them into a single document.
- **Universal File to PDF**: Convert Images (JPG, PNG, WEBP) and Office documents (Word, Excel, PowerPoint) into PDF.
- **Extract PDF Pages**: Visually preview PDF pages using PDF.js and extract selected pages into a new document.

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism design), Vanilla JavaScript, PDF.js for rendering.
- **Backend**: Python 3, FastAPI, PyPDF, Pillow, docx2pdf, pywin32 (for Office COM automation).

## 🚀 How to Run Locally

### 1. Start the Backend
Navigate to the project root and activate your virtual environment, then install dependencies:
```bash
pip install -r requirements.txt
cd backend
python -m uvicorn main:app --reload
```

### 2. Start the Frontend
Simply open `frontend/index.html` in any modern web browser.

## ⚠️ Note on Office Document Conversion
The Office-to-PDF conversion feature relies on Microsoft Office COM automation. Therefore, to use the Word, Excel, and PowerPoint conversion features, the backend must be run on a **Windows machine** with Microsoft Office installed.

## 📄 License
This project is open-source and available under the MIT License.
