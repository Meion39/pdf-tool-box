# 📄 My PDF Toolbox

A modern, fast, and fully functional full-stack web application for PDF processing.

## ✨ Features

- **Merge PDFs**: Drag and drop multiple PDF files, reorder them, and merge them into a single document.
- **Image to PDF**: Convert Images (JPG, PNG, WEBP) into PDF.
- **Extract PDF Pages**: Visually preview PDF pages using PDF.js and extract selected pages into a new document.

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism design), Vanilla JavaScript, PDF.js for rendering.
- **Backend**: Python 3, FastAPI, PyPDF, Pillow.

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

## 📄 License
This project is open-source and available under the MIT License.

 