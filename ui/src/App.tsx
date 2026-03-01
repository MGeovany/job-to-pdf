import { useState } from 'react'
import { UploadCloud, FileText, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

function App() {
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [jobPost, setJobPost] = useState('')

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile)
      } else {
        alert("Please upload a valid PDF file.")
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleGenerate = () => {
    if (!file || !jobPost.trim()) {
      alert("Please provide both a PDF and a Job Description")
      return
    }
    // TODO: implement integration with job2pdf backend
    alert("Generation started! (Integration pending)")
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground font-sans p-4 md:p-8 flex items-center justify-center">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Header / Intro Area */}
        <div className="col-span-1 lg:col-span-2 text-center mb-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
            job2pdf Generator
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Upload your master resume PDF and paste the job description.
            We'll automatically tailor a professional, minimalist PDF specifically for this role.
          </p>
        </div>

        {/* Left Column: PDF Upload */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileText className="w-6 h-6 text-emerald-500" /> Original Resume
            </CardTitle>
            <CardDescription>Upload your base profile in PDF format.</CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className={`
                relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-300
                ${dragActive ? 'border-emerald-500 bg-emerald-500/10 scale-[1.02]' : 'border-muted-foreground/25 hover:border-emerald-500/50 hover:bg-accent/50'}
                ${file ? 'border-emerald-500/50 bg-emerald-500/5' : ''}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input 
                type="file" 
                accept=".pdf" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleChange}
              />
              {file ? (
                <div className="flex flex-col items-center gap-3 text-emerald-400">
                  <CheckCircle2 className="w-12 h-12" />
                  <span className="font-medium text-lg text-emerald-200">{file.name}</span>
                  <span className="text-sm text-emerald-500/70">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <Button variant="outline" size="sm" className="mt-4 pointer-events-none border-emerald-500/30 text-emerald-300">
                    Change PDF
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className="w-12 h-12 mb-4 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-emerald-500">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground/70">PDF files only (Max 10MB)</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Job Description */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500 flex flex-col">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-500">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              Job Description
            </CardTitle>
            <CardDescription>Paste the job post you want to tailor your PDF for.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col group">
            <Label htmlFor="job-post" className="sr-only">Job Post</Label>
            <Textarea 
              id="job-post" 
              placeholder="Paste the full job description here... (Responsibilities, Requirements, etc.)"
              className="min-h-[250px] resize-none flex-grow focus-visible:ring-cyan-500/50 transition-shadow bg-background/50 backdrop-blur-md"
              value={jobPost}
              onChange={(e) => setJobPost(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Action Area */}
        <div className="col-span-1 lg:col-span-2 flex justify-center mt-4">
          <Button 
            size="lg" 
            className="w-full md:w-auto px-12 py-6 text-lg font-bold rounded-2xl shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.5)] bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 transition-all duration-300 scale-100 hover:scale-105"
            onClick={handleGenerate}
            disabled={!file || !jobPost.trim()}
          >
            Generate Tailored PDF
            <svg className="w-5 h-5 ml-2 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </Button>
        </div>

      </div>
    </div>
  )
}

export default App
