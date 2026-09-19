import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Trash2,
  MessageSquare,
  HelpCircle,
  Sparkles,
  Filter,
  X,
  AlertTriangle
} from 'lucide-react'

const INITIAL_LECTURES = [
  {
    id: 'lec_1',
    title: 'Lec01_Introduction_to_Artificial_Intelligence.pdf',
    module: 'CS 401: Artificial Intelligence',
    fileType: 'PDF',
    size: '2.4 MB',
    pages: 34,
    chunks: 48,
    uploadedAt: 'Sep 14, 2026',
    status: 'Indexed',
  },
  {
    id: 'lec_2',
    title: 'Lec04_Heuristic_Search_A_Star_Algorithm.pdf',
    module: 'CS 401: Artificial Intelligence',
    fileType: 'PDF',
    size: '3.1 MB',
    pages: 42,
    chunks: 64,
    uploadedAt: 'Sep 15, 2026',
    status: 'Indexed',
  },
  {
    id: 'lec_3',
    title: 'Lec03_Deep_Neural_Networks_Backpropagation.docx',
    module: 'CS 480: Machine Learning',
    fileType: 'DOCX',
    size: '1.8 MB',
    pages: 28,
    chunks: 39,
    uploadedAt: 'Sep 16, 2026',
    status: 'Indexed',
  },
  {
    id: 'lec_4',
    title: 'Lec02_Bayesian_Inference_and_Conditionals.pdf',
    module: 'STAT 350: Applied Probability',
    fileType: 'PDF',
    size: '1.2 MB',
    pages: 18,
    chunks: 25,
    uploadedAt: 'Sep 17, 2026',
    status: 'Indexed',
  },
]

export default function LecturePage() {
  const [lectures, setLectures] = useState(INITIAL_LECTURES)
  const [selectedModule, setSelectedModule] = useState('CS 401: Artificial Intelligence')
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadStep, setUploadStep] = useState('')
  const [filterModule, setFilterModule] = useState('all')
  const [lectureToDelete, setLectureToDelete] = useState(null)
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
    }
  }

  const processFiles = (files) => {
    const file = files[0]
    setUploading(true)

    // Simulate RAG ingestion pipeline steps
    setUploadStep('Extracting raw text and page numbering...')
    setTimeout(() => {
      setUploadStep('Cleaning headers, footers & normalizing text...')
      setTimeout(() => {
        setUploadStep('Splitting into 500-token semantic chunks...')
        setTimeout(() => {
          setUploadStep('Generating vector embeddings & saving to pgvector...')
          setTimeout(() => {
            const ext = file.name.split('.').pop().toUpperCase()
            const newLecture = {
              id: 'lec_' + Date.now(),
              title: file.name,
              module: selectedModule,
              fileType: ext || 'PDF',
              size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
              pages: Math.floor(Math.random() * 30) + 10,
              chunks: Math.floor(Math.random() * 50) + 20,
              uploadedAt: 'Just now',
              status: 'Indexed',
            }
            setLectures([newLecture, ...lectures])
            setUploading(false)
            setUploadStep('')
          }, 600)
        }, 600)
      }, 500)
    }, 500)
  }

  const handleDelete = (lecture) => {
    setLectureToDelete(lecture)
  }

  const confirmDelete = () => {
    if (!lectureToDelete) return
    setLectures((currentLectures) =>
      currentLectures.filter((lecture) => lecture.id !== lectureToDelete.id)
    )
    setLectureToDelete(null)
  }

  const filteredLectures =
    filterModule === 'all'
      ? lectures
      : lectures.filter((l) => l.module.includes(filterModule))

  return (
    <div className="stagger-children">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-actions">
          <div>
            <h1>Lecture Upload & Document Library</h1>
            <p>
              Upload your lecture slides or notes. The RAG pipeline will extract, chunk,
              embed, and prepare them for cited AI chat and quizzes.
            </p>
          </div>
        </div>
      </div>

      {/* Upload Box Card */}
      <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Assign to Module:</span>
            <select
              className="input"
              style={{ width: 'auto', padding: '6px 12px' }}
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              disabled={uploading}
            >
              <option value="CS 401: Artificial Intelligence">CS 401: Artificial Intelligence</option>
              <option value="CS 480: Machine Learning">CS 480: Machine Learning</option>
              <option value="STAT 350: Applied Probability">STAT 350: Applied Probability</option>
              <option value="CS 210: Data Structures & Algorithms">CS 210: Data Structures</option>
            </select>
          </div>
          <span className="badge badge-accent">
            <Sparkles size={12} /> Auto-RAG Pipeline Ready
          </span>
        </div>

        {uploading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-4)' }}>
            <div className="animate-spin" style={{ margin: '0 auto var(--space-4)', width: '36px', height: '36px', border: '3px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%' }} />
            <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>
              Processing Lecture with RAG Pipeline...
            </div>
            <div style={{ color: 'var(--accent)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              {uploadStep}
            </div>
          </div>
        ) : (
          <div
            className={`upload-zone ${dragOver ? 'dragover' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <div className="upload-zone-icon">
              <UploadCloud size={30} />
            </div>
            <div className="upload-zone-title">Click to upload or drag & drop lecture files</div>
            <div className="upload-zone-desc">
              Supports PDF, Word Documents (.docx), and Plain Text (.txt) up to 25MB
            </div>
            <div className="upload-zone-formats">
              <span className="badge badge-neutral">PDF with page tracking</span>
              <span className="badge badge-neutral">DOCX</span>
              <span className="badge badge-neutral">TXT</span>
            </div>
          </div>
        )}
      </div>

      {/* Uploaded Documents List */}
      <div className="section-card">
        <div className="section-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h3>Uploaded Lectures ({filteredLectures.length})</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              className="input"
              style={{ width: 'auto', padding: '4px 10px', fontSize: 'var(--text-xs)' }}
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
            >
              <option value="all">All Modules</option>
              <option value="CS 401">CS 401 (AI)</option>
              <option value="CS 480">CS 480 (ML)</option>
              <option value="STAT 350">STAT 350 (Probability)</option>
            </select>
          </div>
        </div>

        <div style={{ padding: 'var(--space-4)' }}>
          {filteredLectures.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <FileText size={32} />
              </div>
              <div className="empty-state-title">No lecture files in this category</div>
              <div className="empty-state-desc">Upload notes above to begin study indexing.</div>
            </div>
          ) : (
            <div className="lecture-list">
              {filteredLectures.map((lec) => (
                <div key={lec.id} className="lecture-item">
                  <div
                    className="lecture-item-icon"
                    style={{
                      background: lec.fileType === 'PDF' ? 'var(--danger-light)' : 'var(--primary-light)',
                      color: lec.fileType === 'PDF' ? 'var(--danger)' : 'var(--primary)',
                    }}
                  >
                    <FileText size={22} />
                  </div>

                  <div className="lecture-item-info">
                    <div className="lecture-item-title">{lec.title}</div>
                    <div className="lecture-item-meta">
                      <span className="badge badge-primary">{lec.module.split(':')[0]}</span>
                      <span>{lec.size}</span>
                      <span>•</span>
                      <span>{lec.pages} pages</span>
                      <span>•</span>
                      <span className="badge badge-accent">
                        <CheckCircle2 size={12} /> {lec.chunks} chunks indexed
                      </span>
                      <span>•</span>
                      <span>Uploaded {lec.uploadedAt}</span>
                    </div>
                  </div>

                  <div className="lecture-item-actions">
                    <Link
                      to="/chat"
                      className="btn btn-ghost btn-sm"
                      title="Chat with this lecture"
                    >
                      <MessageSquare size={16} />
                      <span>Chat</span>
                    </Link>
                    <Link
                      to="/quiz"
                      className="btn btn-ghost btn-sm"
                      title="Generate quiz from this lecture"
                    >
                      <HelpCircle size={16} />
                      <span>Quiz</span>
                    </Link>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDelete(lec)}
                      title="Delete lecture"
                      style={{ color: 'var(--danger)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {lectureToDelete && (
        <div className="modal-overlay" onClick={() => setLectureToDelete(null)}>
          <div
            className="modal delete-confirmation-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-lecture-title"
            aria-describedby="delete-lecture-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="delete-confirmation-heading">
                <span className="delete-confirmation-icon">
                  <AlertTriangle size={22} />
                </span>
                <h2 id="delete-lecture-title">Delete lecture?</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setLectureToDelete(null)}
                aria-label="Close delete confirmation"
              >
                <X size={20} />
              </button>
            </div>
            <p id="delete-lecture-description" className="delete-confirmation-text">
              Are you sure you want to delete <strong>{lectureToDelete.title}</strong>? This action
              cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setLectureToDelete(null)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete}>
                <Trash2 size={16} />
                Delete lecture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
