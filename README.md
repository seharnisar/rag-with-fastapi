# RAG Chatbot 🤖

A sophisticated Retrieval-Augmented Generation (RAG) chatbot application that allows users to upload documents and engage in intelligent conversations based on their content. Built with FastAPI backend, React frontend, and powered by Ollama's LLaMA 3 model.

## ✨ Features

- **📚 Document Management**: Upload and process PDF documents with automatic text extraction and chunking
- **🧠 Intelligent Chat**: Context-aware conversations using RAG architecture with vector similarity search
- **🔐 User Authentication**: Secure JWT-based authentication with user registration and login
- **🎯 Personalized Experience**: Each user has their own isolated document collection and chat history
- **⚡ Real-time Processing**: Background document ingestion with status tracking
- **🎨 Modern UI**: Clean, responsive React frontend with markdown rendering support

## 🏗️ Architecture

### Backend (FastAPI)
- **FastAPI**: Modern, fast web framework for building APIs
- **PostgreSQL**: Relational database for user management and document metadata
- **ChromaDB**: Vector database for semantic search and document embeddings
- **Ollama**: Local LLM integration using LLaMA 3 for chat responses
- **LangChain**: Framework for RAG pipeline implementation
- **JWT Authentication**: Secure token-based user authentication

### Frontend (React)
- **React 19**: Modern React with hooks and concurrent features
- **Vite**: Fast build tool and development server
- **React Markdown**: Beautiful markdown rendering for chat responses
- **Tailwind CSS**: Utility-first CSS framework for styling

### AI/ML Stack
- **LLaMA 3**: Advanced language model for natural language understanding
- **Nomic Embed Text**: High-quality text embeddings for semantic search
- **RAG Pipeline**: Document retrieval → context augmentation → response generation

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Rag-bot
   ```

2. **Start all services**
   ```bash
   docker-compose up --build
   ```

3. **Install Ollama models** (in a separate terminal)
   ```bash
   docker exec -it rag-bot-ollama-1 ollama pull llama3
   docker exec -it rag-bot-ollama-1 ollama pull nomic-embed-text
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Option 2: Local Development

#### Prerequisites
- Python 3.8+
- Node.js 18+
- PostgreSQL
- Ollama with LLaMA 3 and Nomic Embed Text models

#### Installation

1. **Set up Python environment**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Install Ollama models**
   ```bash
   ollama pull llama3
   ollama pull nomic-embed-text
   ```

3. **Set up database**
   ```bash
   # Create PostgreSQL database
   createdb chatbot
   
   # Update .env with your database URL
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

#### Running the Application

**Option A: Separate terminals**
```bash
# Terminal 1 - Backend
source .venv/bin/activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**Option B: Single command (runs both)**
```bash
# Start backend in background
source .venv/bin/activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000 &

# Start frontend
cd frontend
npm run dev
```

## 📁 Project Structure

```
Rag-bot/
├── backend/
│   ├── auth/           # Authentication routes and models
│   ├── chat/           # RAG chat functionality
│   ├── documents/      # Document upload and processing
│   ├── database/       # Database configuration and models
│   └── main.py         # FastAPI application entry point
├── frontend/
│   ├── src/
│   │   ├── App.jsx     # Main React application
│   │   └── assets/     # Static assets
│   └── package.json    # Frontend dependencies
├── chroma_db/          # Vector database storage
├── uploads/            # Uploaded document storage
├── requirements.txt    # Python dependencies
└── .env               # Environment variables
```

## 🔧 Configuration

### Environment Variables (.env)
```env
DATABASE_URL=postgresql://username:password@localhost:5432/chatbot
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
OLLAMA_BASE_URL=http://localhost:11434
CHROMA_PATH=./chroma_db
UPLOAD_DIR=./uploads
```

## 📖 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user info

### Documents
- `POST /documents/upload` - Upload document
- `GET /documents` - List user documents
- `DELETE /documents/{id}` - Delete document

### Chat
- `POST /chat` - Send chat message
- `GET /chat/history` - Get chat history

## 🤖 RAG Pipeline

The application implements a sophisticated RAG pipeline:

1. **Document Ingestion**: PDFs are processed, text extracted, and split into chunks
2. **Embedding Generation**: Text chunks are converted to vector embeddings using Nomic Embed Text
3. **Vector Storage**: Embeddings are stored in ChromaDB with user isolation
4. **Query Processing**: User questions are embedded and used for similarity search
5. **Context Retrieval**: Relevant document chunks are retrieved based on semantic similarity
6. **Response Generation**: LLaMA 3 generates responses using retrieved context as reference

## 🛠️ Development

### Backend Development
```bash
# Run with auto-reload
uvicorn backend.main:app --reload

# Run tests
pytest

# Database migrations
alembic upgrade head
```

### Frontend Development
```bash
# Development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

## 🔒 Security Features

- JWT-based authentication with secure token handling
- Password hashing using bcrypt
- User data isolation in vector database
- CORS configuration for frontend-backend communication
- Input validation and sanitization

## 📊 Performance Considerations

- Efficient document chunking for optimal retrieval
- Vector similarity search with configurable k-value
- Background processing for document ingestion
- Lazy loading of chat history
- Optimized React rendering with hooks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙋‍♂️ Support

If you have any questions or run into issues, please:

1. Check the [API documentation](http://localhost:8000/docs)
2. Review the troubleshooting section below
3. Open an issue on GitHub

## 🔧 Troubleshooting

### Common Issues

**Ollama Connection Error**
- Ensure Ollama is running: `ollama serve`
- Verify models are installed: `ollama list`

**Database Connection Error**
- Check PostgreSQL is running
- Verify DATABASE_URL in .env file
- Ensure database exists: `createdb chatbot`

**Document Upload Fails**
- Check file permissions in uploads directory
- Verify PDF files are not corrupted
- Check backend logs for detailed error messages

**Frontend Not Loading**
- Ensure backend is running on port 8000
- Check CORS configuration in backend
- Verify frontend dependencies are installed

=======
# rag-with-fastapi
>>>>>>> 531e3ecc340bd8ce4fb82325b90983024f9d2c1e
