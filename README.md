# InsightFlow AI - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js (LTS recommended)
- Gemini API Key

### Backend Setup (2 minutes)

```bash
# 1. Navigate to backend
cd backend

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure API key
cp .env.example .env
# Edit .env and add: GEMINI_API_KEY=your_key_here

# 4. Run server
python api.py
```

Server starts on `http://localhost:8000`

### Frontend Setup (2 minutes)

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Run development server
npm run dev
```

Frontend starts on `http://localhost:5173`

## ✅ What's New

### Security Improvements
- ✅ Secure code execution (no arbitrary code attacks)
- ✅  Input validation on all endpoints
- ✅ File size/type restrictions
- ✅ Environment-based CORS configuration

### Reliability Improvements
- ✅ Structured logging to `app.log`
- ✅ Disk-based storage (no memory issues)
- ✅ Automatic session cleanup
- ✅ Proper error handling

### Performance Improvements
- ✅ LLM response caching
- ✅ Better CSV parsing with PapaParse
- ✅ Request timeouts

### AI Improvements
- ✅ Enhanced prompts with examples
- ✅ Better context management
- ✅ Improved error recovery

## 📂 Project Structure

```
AI_data_analysis-master/
├── backend/
│   ├── api.py              # FastAPI application
│   ├── backend.py          # Core logic
│   ├── config.py           # Configuration
│   ├── logger.py           # Logging
│   ├── validators.py       # Input validation
│   ├── storage.py          # Disk storage
│   ├── cache.py            # LLM caching
│   ├── requirements.txt    # Python dependencies
│   ├── .env.example        # Environment template
│   └── tests/              # Test suite
├── frontend/
│   ├── App.tsx             # Main app component
│   ├── config.ts           # Frontend config
│   ├── services/           # API services
│   ├── views/             # UI views
│   ├── package.json        # NPM dependencies
│   └── .env.example        # Environment template
└── README.md               # This file
```

## ⚙️ Configuration

### Backend (`.env`)
```bash
# Required
GEMINI_API_KEY=your_key_here

# Optional
MAX_FILE_SIZE_MB=50
LOG_LEVEL=INFO
SESSION_TTL_HOURS=24
```

### Frontend (`.env.local`)
```bash
# Optional
VITE_API_BASE_URL=http://localhost:8000
VITE_API_TIMEOUT=30000
```

## 🧪 Running Tests

```bash
cd backend
pytest tests/ -v
```

## 📖 Documentation

- **Full Walkthrough**: See [walkthrough.md](file:///C:/Users/Admin/.gemini/antigravity/brain/ad18de04-a3b1-44aa-91ee-68d471414b55/walkthrough.md)
- **Implementation Plan**: See [implementation_plan.md](file:///C:/Users/Admin/.gemini/antigravity/brain/ad18de04-a3b1-44aa-91ee-68d471414b55/implementation_plan.md)
- **Improvements**: See [improvement_recommendations.md](file:///C:/Users/Admin/.gemini/antigravity/brain/ad18de04-a3b1-44aa-91ee-68d471414b55/improvement_recommendations.md)

## 🎯 Key Features

- **AI-Powered Analysis**: Chat with Gemini AI to analyze data
- **Code Execution**: Run Python transformations safely
- **Visualizations**: Create charts and graphs
- **Data Cleaning**: Remove duplicates, handle missing values
- **Export**: Download processed datasets

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

---

**Built with** ❤️ **using FastAPI, React, and Gemini AI**
