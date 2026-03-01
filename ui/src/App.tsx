import { useState, useEffect } from 'react'
import { UploadCloud, FileText, CheckCircle2, Plus, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type JobPost = {
  id: string;
  title: string;
  content: string;
}

function App() {
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  
  // Job Posts State
  const [jobPosts, setJobPosts] = useState<JobPost[]>([
    { id: '1', title: 'Post 1', content: '' }
  ])
  const [activeTab, setActiveTab] = useState('1')
  
  // Generation State
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationSuccess, setGenerationSuccess] = useState(false)

  // Force dark mode on body
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

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

  const handleJobPostChange = (id: string, newContent: string) => {
    setJobPosts(posts => 
      posts.map(post => post.id === id ? { ...post, content: newContent } : post)
    )
  }

  const addJobPost = () => {
    const newId = String(Date.now())
    const newTitle = `Post ${jobPosts.length + 1}`
    setJobPosts([...jobPosts, { id: newId, title: newTitle, content: '' }])
    setActiveTab(newId)
  }

  const removeJobPost = (idToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent tab switching when clicking the X
    if (jobPosts.length === 1) return // Don't remove the last tab
    
    const newPosts = jobPosts.filter(p => p.id !== idToRemove)
    setJobPosts(newPosts)
    
    // If we removed the active tab, switch to the last available tab
    if (activeTab === idToRemove) {
      setActiveTab(newPosts[newPosts.length - 1].id)
    }
  }

  const handleGenerate = () => {
    const currentPost = jobPosts.find(p => p.id === activeTab)
    if (!file || !currentPost?.content.trim()) return

    setIsGenerating(true)
    setGenerationSuccess(false)
    
    // Simulate generation delay
    setTimeout(() => {
      setIsGenerating(false)
      setGenerationSuccess(true)
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setGenerationSuccess(false)
      }, 3000)
    }, 2000)
  }

  const currentPost = jobPosts.find(p => p.id === activeTab)
  const isGenerateDisabled = !file || !currentPost?.content.trim() || isGenerating

  return (
    <div className="dark min-h-screen bg-black text-white font-sans p-6 md:p-12 flex items-center justify-center selection:bg-neutral-800 selection:text-white relative">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
        
        {/* Header Area */}
        <div className="col-span-1 lg:col-span-2 mb-4">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-100">
            Job To PDF
          </h1>
        </div>

        {/* Left Column: PDF Upload */}
        <Card className="rounded-lg border border-neutral-800 bg-black text-neutral-100 h-fit">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2 text-neutral-200">
              <FileText className="w-4 h-4 text-neutral-500" /> Original Resume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className={`
                relative flex flex-col items-center justify-center w-full h-[280px] rounded-md border border-neutral-800 bg-neutral-950/50 transition-colors
                ${dragActive ? 'border-neutral-500 bg-neutral-900' : 'hover:bg-neutral-900 hover:border-neutral-700'}
                ${file ? 'border-neutral-700 bg-neutral-900/50' : ''}
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
                <div className="flex flex-col items-center gap-2 text-neutral-300">
                  <CheckCircle2 className="w-8 h-8 text-neutral-100" />
                  <span className="font-medium text-sm truncate max-w-[200px] text-center" title={file.name}>{file.name}</span>
                  <span className="text-xs text-neutral-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <Button variant="outline" size="sm" className="mt-4 pointer-events-none border-neutral-800 bg-black text-neutral-300 rounded-md h-8 text-xs font-medium">
                    Change file
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className="w-8 h-8 mb-3 text-neutral-500" />
                  <p className="mb-1 text-sm font-medium text-neutral-200">
                    Upload file
                  </p>
                  <p className="text-xs text-neutral-500">Drag & drop your PDF</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Multiple Job Descriptions */}
        <Card className="rounded-lg border border-neutral-800 bg-black flex flex-col h-fit">
          <CardHeader className="pb-0 border-b border-neutral-800 pt-5 px-6">
            <div className="flex items-center justify-between mb-4">
               <CardTitle className="text-base font-medium flex items-center gap-2 text-neutral-200">
                <div className="flex items-center justify-center w-4 h-4 text-neutral-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                Job Post Targets
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col pt-0 px-6 pb-6">
             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
                <div className="flex items-center justify-between">
                  <TabsList className="bg-neutral-900 border border-neutral-800 h-9 p-1 overflow-x-auto justify-start max-w-[85%] no-scrollbar inline-flex">
                    {jobPosts.map((post) => (
                      <TabsTrigger 
                        key={post.id} 
                        value={post.id} 
                        className="text-xs h-7 px-3 min-w-16 flex items-center gap-2 m-0 border border-transparent data-[state=active]:border-neutral-700"
                      >
                        {post.title}
                        {jobPosts.length > 1 && (
                          <div 
                            className="p-0.5 rounded-sm hover:bg-neutral-700/50 text-neutral-500 hover:text-neutral-300 transition-colors inline-block"
                            onClick={(e) => removeJobPost(post.id, e)}
                          >
                            <X className="w-3 h-3" />
                          </div>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 ml-2 bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white rounded-md flex-shrink-0"
                    onClick={addJobPost}
                    title="Add another job post"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {jobPosts.map((post) => (
                  <TabsContent key={post.id} value={post.id} className="mt-4 outline-none">
                    <Label htmlFor={`job-post-${post.id}`} className="sr-only">Job Post {post.id}</Label>
                    <Textarea 
                      id={`job-post-${post.id}`} 
                      placeholder="Paste job description here..."
                      className="min-h-[225px] resize-none w-full bg-black border-neutral-800 text-neutral-200 placeholder:text-neutral-600 focus-visible:ring-1 focus-visible:ring-neutral-700 focus-visible:ring-offset-0 rounded-md text-sm"
                      value={post.content}
                      onChange={(e) => handleJobPostChange(post.id, e.target.value)}
                    />
                  </TabsContent>
                ))}
              </Tabs>
          </CardContent>
        </Card>

        {/* Action Area & Feedback */}
        <div className="col-span-1 lg:col-span-2 flex flex-col items-start mt-2 gap-4">
          <div className="flex items-center gap-4">
            <Button 
              className="px-6 py-2.5 h-10 text-sm font-medium rounded-md bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:bg-neutral-900 border disabled:border-neutral-800 disabled:text-neutral-500 w-40"
              onClick={handleGenerate}
              disabled={isGenerateDisabled}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : "Generate PDF"}
            </Button>
            
            {generationSuccess && (
              <span className="text-sm font-medium text-neutral-400 flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                <CheckCircle2 className="w-4 h-4 text-white" />
                Successfully generated PDF!
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export default App
