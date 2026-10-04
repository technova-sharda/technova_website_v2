'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateProfile } from "@/lib/actions/profile"
import { User, Hash, GraduationCap, Phone, Sparkles, ArrowLeft, Save, Loader2, Link2, Globe, Handshake } from "lucide-react"
import Link from "next/link"

const COURSES = [
    { value: "CSE", label: "Computer Science & Engineering" },
    { value: "CSE-AIML", label: "CSE (AI & Machine Learning)" },
    { value: "CSE-DS", label: "CSE (Data Science)" },
    { value: "CSE-IOT", label: "CSE (Internet of Things)" },
    { value: "CSE-CS", label: "CSE (Cyber Security)" },
    { value: "CSE-ARVR", label: "CSE (Augmented & VR)" },
    { value: "IT", label: "Information Technology" },
    { value: "ECE", label: "Electronics & Communication" },
    { value: "EE", label: "Electrical Engineering" },
    { value: "ME", label: "Mechanical Engineering" },
    { value: "CE", label: "Civil Engineering" },
    { value: "BCA", label: "Bachelor of Computer Applications" },
    { value: "MCA", label: "Master of Computer Applications" },
    { value: "Other", label: "Other" },
]

const SECTIONS = Array.from({ length: 19 }, (_, i) => String.fromCharCode(65 + i))

const SKILL_SUGGESTIONS = [
    "Python", "JavaScript", "React", "Node.js", "Java", "C++", "Machine Learning",
    "Data Science", "AWS", "Docker", "UI/UX Design", "Figma", "Flutter", "Android"
]

interface ProfileEditFormProps {
    initialData: {
        system_id?: string
        year?: number
        course?: string
        section?: string
        mobile?: string
        skills?: string[]
        github_url?: string | null
        linkedin_url?: string | null
        portfolio_url?: string | null
        kaggle_url?: string | null
        leetcode_url?: string | null
        codeforces_url?: string | null
        codechef_url?: string | null
        gfg_url?: string | null
        hackerrank_url?: string | null
    } | null
}

export function ProfileEditForm({ initialData }: ProfileEditFormProps) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)

    // Controlled form state
    const [systemId, setSystemId] = useState(initialData?.system_id || '')
    const [year, setYear] = useState(initialData?.year?.toString() || '')
    const [course, setCourse] = useState(initialData?.course || '')
    const [section, setSection] = useState(initialData?.section || '')
    const [mobile, setMobile] = useState(initialData?.mobile || '')
    const [skills, setSkills] = useState<string[]>(initialData?.skills || [])
    const [skillInput, setSkillInput] = useState("")
    const [systemIdError, setSystemIdError] = useState("")

    // Social Links State
    const [githubUrl, setGithubUrl] = useState(initialData?.github_url || '')
    const [linkedinUrl, setLinkedinUrl] = useState(initialData?.linkedin_url || '')
    const [portfolioUrl, setPortfolioUrl] = useState(initialData?.portfolio_url || '')
    const [kaggleUrl, setKaggleUrl] = useState(initialData?.kaggle_url || '')
    const [leetcodeUrl, setLeetcodeUrl] = useState(initialData?.leetcode_url || '')
    const [codeforcesUrl, setCodeforcesUrl] = useState(initialData?.codeforces_url || '')
    const [codechefUrl, setCodechefUrl] = useState(initialData?.codechef_url || '')
    const [gfgUrl, setGfgUrl] = useState(initialData?.gfg_url || '')
    const [hackerrankUrl, setHackerrankUrl] = useState(initialData?.hackerrank_url || '')

    const router = useRouter()

    function addSkill(skill: string) {
        const trimmed = skill.trim()
        if (trimmed && !skills.includes(trimmed) && skills.length < 10) {
            setSkills([...skills, trimmed])
            setSkillInput("")
        }
    }

    function removeSkill(skill: string) {
        setSkills(skills.filter(s => s !== skill))
    }

    function validateSystemId(value: string): boolean {
        if (value.length !== 10) {
            setSystemIdError("System ID must be exactly 10 digits")
            return false
        }
        if (!/^\d{10}$/.test(value)) {
            setSystemIdError("System ID must contain only digits")
            return false
        }
        setSystemIdError("")
        return true
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError("")
        setSuccess(false)

        if (systemId && !validateSystemId(systemId)) {
            return
        }

        const formData = new FormData()
        formData.set("system_id", systemId)
        formData.set("year", year)
        formData.set("course", course)
        formData.set("section", section)
        formData.set("mobile", mobile)
        formData.set("skills", skills.join(", "))

        // Social Links
        formData.set("github_url", githubUrl)
        formData.set("linkedin_url", linkedinUrl)
        formData.set("portfolio_url", portfolioUrl)
        formData.set("kaggle_url", kaggleUrl)
        formData.set("leetcode_url", leetcodeUrl)
        formData.set("codeforces_url", codeforcesUrl)
        formData.set("codechef_url", codechefUrl)
        formData.set("gfg_url", gfgUrl)
        formData.set("hackerrank_url", hackerrankUrl)

        startTransition(async () => {
            try {
                const result = await updateProfile(formData)
                if (result?.error) {
                    setError(result.error)
                } else {
                    setSuccess(true)
                    router.refresh()
                    setTimeout(() => setSuccess(false), 3000)
                }
            } catch {
                setError("Failed to save changes")
            }
        })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* System ID */}
            <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <Hash className="w-4 h-4 text-blue-500" />
                    System ID
                </label>
                <input
                    value={systemId}
                    onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '')
                        setSystemId(value)
                        if (value.length === 10) {
                            validateSystemId(value)
                        } else if (value.length > 0) {
                            setSystemIdError(`${10 - value.length} more digits needed`)
                        } else {
                            setSystemIdError("")
                        }
                    }}
                    maxLength={10}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all font-mono tracking-wider"
                    placeholder="e.g. 2023001234"
                />
                {systemIdError && (
                    <p className="text-xs text-red-400">{systemIdError}</p>
                )}
                <p className="text-xs text-gray-500">Must be exactly 10 digits (found on your ID card)</p>
            </div>

            {/* Year & Course */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <GraduationCap className="w-4 h-4 text-blue-500" />
                        Year
                    </label>
                    <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
                    >
                        <option value="" className="bg-zinc-900">Select Year</option>
                        <option value="1" className="bg-zinc-900">1st Year</option>
                        <option value="2" className="bg-zinc-900">2nd Year</option>
                        <option value="3" className="bg-zinc-900">3rd Year</option>
                        <option value="4" className="bg-zinc-900">4th Year</option>
                        <option value="5" className="bg-zinc-900">5th Year (Integrated)</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <GraduationCap className="w-4 h-4 text-purple-500" />
                        Course
                    </label>
                    <select
                        value={course}
                        onChange={(e) => setCourse(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
                    >
                        <option value="" className="bg-zinc-900">Select Course</option>
                        {COURSES.map(c => (
                            <option key={c.value} value={c.value} className="bg-zinc-900">
                                {c.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Section & Mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <User className="w-4 h-4 text-blue-500" />
                        Section
                    </label>
                    <select
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
                    >
                        <option value="" className="bg-zinc-900">Select Section</option>
                        {SECTIONS.map(char => (
                            <option key={char} value={char} className="bg-zinc-900">{char}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <Phone className="w-4 h-4 text-green-500" />
                        Mobile Number
                    </label>
                    <input
                        type="tel"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                        placeholder="+91 9876543210"
                    />
                </div>
            </div>

            {/* Skills */}
            <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    Skills & Interests
                </label>

                <div className="flex gap-2 mb-4">
                    <div className="flex-1 flex items-center gap-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                        <input
                            type="checkbox"
                            checked={skills.includes("Looking for Team")}
                            onChange={(e) => {
                                if (e.target.checked) setSkills([...skills, "Looking for Team"])
                                else setSkills(skills.filter(s => s !== "Looking for Team"))
                            }}
                            className="w-5 h-5 rounded border-purple-500/50 bg-black/50 text-purple-600 focus:ring-purple-500/50 cursor-pointer"
                        />
                        <div>
                            <p className="text-sm font-medium text-purple-300 flex items-center gap-1.5"><Handshake className="w-4 h-4" /> Looking for Team</p>
                            <p className="text-xs text-purple-400/80">Turn this on to let others know you are looking for a hackathon or project team.</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                addSkill(skillInput)
                            }
                        }}
                        placeholder="Type a skill and press Enter"
                        className="flex-1 bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                    />
                    <button
                        type="button"
                        onClick={() => addSkill(skillInput)}
                        className="px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400 hover:bg-blue-600/30 transition-colors"
                    >
                        Add
                    </button>
                </div>

                {skills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {skills.map(skill => (
                            <span
                                key={skill}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-full text-sm text-blue-300"
                            >
                                {skill}
                                <button
                                    type="button"
                                    onClick={() => removeSkill(skill)}
                                    className="w-4 h-4 rounded-full bg-blue-500/30 hover:bg-red-500/50 flex items-center justify-center text-xs transition-colors"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap gap-2">
                    {SKILL_SUGGESTIONS.filter(s => !skills.includes(s)).slice(0, 6).map(skill => (
                        <button
                            key={skill}
                            type="button"
                            onClick={() => addSkill(skill)}
                            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-all"
                        >
                            + {skill}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-gray-500">These help you find teammates in Buddy Finder</p>
            </div>

            {/* Social Links */}
            <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <Link2 className="w-4 h-4 text-cyan-500" />
                    Social Profiles
                </label>
                <p className="text-xs text-gray-500 -mt-2">Connect your coding profiles to showcase your achievements</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* LinkedIn */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                            </svg>
                            LinkedIn
                        </label>
                        <input
                            type="url"
                            value={linkedinUrl}
                            onChange={(e) => setLinkedinUrl(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                            placeholder="https://linkedin.com/in/username"
                        />
                    </div>

                    {/* GitHub */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            GitHub
                        </label>
                        <input
                            type="url"
                            value={githubUrl}
                            onChange={(e) => setGithubUrl(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                            placeholder="https://github.com/username"
                        />
                    </div>

                    {/* Portfolio */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5" />
                            Portfolio
                        </label>
                        <input
                            type="url"
                            value={portfolioUrl}
                            onChange={(e) => setPortfolioUrl(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                            placeholder="https://yourportfolio.com"
                        />
                    </div>

                    {/* Kaggle */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.825 23.859c-.022.092-.117.141-.281.141h-3.139c-.187 0-.351-.082-.492-.248l-5.178-6.589-1.448 1.374v5.111c0 .235-.117.352-.351.352H5.505c-.236 0-.354-.117-.354-.352V.353c0-.233.118-.353.354-.353h2.431c.234 0 .351.12.351.353v14.343l6.203-6.272c.165-.165.33-.246.495-.246h3.239c.144 0 .236.06.282.18.046.149.034.255-.036.315l-6.555 6.344 6.836 8.507c.095.104.117.208.073.312" />
                            </svg>
                            Kaggle
                        </label>
                        <input
                            type="url"
                            value={kaggleUrl}
                            onChange={(e) => setKaggleUrl(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                            placeholder="https://kaggle.com/username"
                        />
                    </div>

                    {/* LeetCode */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z" />
                            </svg>
                            LeetCode
                        </label>
                        <input
                            type="url"
                            value={leetcodeUrl}
                            onChange={(e) => setLeetcodeUrl(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                            placeholder="https://leetcode.com/username"
                        />
                    </div>

                    {/* Codeforces */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M4.5 7.5C5.328 7.5 6 8.172 6 9v10.5c0 .828-.672 1.5-1.5 1.5h-3C.672 21 0 20.328 0 19.5V9c0-.828.672-1.5 1.5-1.5h3zm9-4.5c.828 0 1.5.672 1.5 1.5v15c0 .828-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.672-1.5-1.5v-15c0-.828.672-1.5 1.5-1.5h3zm9 7.5c.828 0 1.5.672 1.5 1.5v7.5c0 .828-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.672-1.5-1.5V12c0-.828.672-1.5 1.5-1.5h3z" />
                            </svg>
                            Codeforces
                        </label>
                        <input
                            type="url"
                            value={codeforcesUrl}
                            onChange={(e) => setCodeforcesUrl(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                            placeholder="https://codeforces.com/profile/username"
                        />
                    </div>

                    {/* CodeChef */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.007 0c-.787.031-1.515.37-2.222.685a12.27 12.27 0 01-1.864.703c-.635.176-1.3.354-1.814.726-.19.138-.36.306-.546.449-.051.02-.104.048-.156.073a4.861 4.861 0 00-.755.475c-.474.375-.868.839-1.202 1.353-.586.903-.997 1.918-1.261 2.967-.346 1.376-.397 2.83-.118 4.224.272 1.353.817 2.645 1.587 3.791.134.196.233.428.401.6.123.026.211-.104.273-.195.282-.4.54-.814.763-1.246.228-.44.413-.906.636-1.34.015-.027.034-.056.026-.09a.323.323 0 00-.133-.158c-.236-.2-.51-.362-.782-.49-.547-.266-1.146-.43-1.69-.69-.39-.186-.795-.44-1.047-.81-.104-.121-.225-.285-.155-.45.097-.217.342-.32.546-.398.348-.137.716-.207 1.08-.263a9.705 9.705 0 011.623-.104c.39.015.779.052 1.167.102a.397.397 0 00.212-.048c.134-.078.182-.247.197-.393.024-.23-.015-.46-.093-.675-.085-.29-.207-.565-.304-.85-.083-.246-.196-.513-.127-.772.04-.116.151-.195.258-.243.336-.146.71-.18 1.07-.19a6.403 6.403 0 011.145.075c.303.046.61.1.895.2.108.037.22.087.305.17.09.088.137.21.151.334.031.263-.056.522-.13.771-.094.283-.192.57-.233.867-.025.18-.04.36-.01.54.024.14.094.28.19.386.073.082.18.119.282.133.405.058.815.042 1.222.01.502-.04 1.005-.093 1.508-.092.518 0 1.034.022 1.55.073.502.05.996.13 1.475.286.292.095.58.218.81.41.132.11.255.26.304.429.05.176.037.36.022.537-.015.177-.043.354-.104.52-.07.191-.194.355-.333.498-.418.43-.937.725-1.477.946-.443.181-.906.307-1.365.44-.357.103-.72.206-1.054.376-.11.056-.222.128-.287.24-.03.052-.042.113-.045.173-.007.131.025.262.042.392.048.37.045.746.045 1.12v4.3c-.007.292-.027.588-.138.86-.06.145-.163.27-.297.35-.164.098-.35.155-.539.194-.26.055-.525.088-.789.12-.48.054-.962.1-1.445.14-.357.03-.714.054-1.071.057-.457.003-.914-.013-1.37-.038-.34-.019-.68-.044-1.017-.087-.218-.028-.435-.065-.651-.107-.127-.024-.256-.045-.376-.097a.344.344 0 01-.155-.124c-.067-.1-.095-.223-.107-.344a2.387 2.387 0 01.012-.462 10.087 10.087 0 01.135-.75c.054-.244.116-.485.183-.724.115-.412.244-.82.387-1.223.098-.276.206-.548.317-.818.093-.224.191-.445.29-.666v-.003c.124-.275.25-.55.37-.826-.036-.21-.188-.394-.375-.49-.393-.2-.84-.268-1.274-.3-.462-.034-.925-.033-1.388-.01-.408.02-.817.057-1.222.125-.283.048-.567.113-.835.217a.787.787 0 00-.333.208c-.059.063-.096.148-.089.234.022.29.176.55.34.776.318.436.698.825 1.108 1.178.477.41 1 .778 1.554 1.09.65.364 1.342.658 2.054.877.77.239 1.567.385 2.37.447.443.034.888.044 1.332.037.378-.007.756-.027 1.132-.06.502-.043 1.001-.112 1.492-.22a8.15 8.15 0 001.335-.398c.255-.098.504-.212.743-.346.067-.037.136-.074.197-.122.044-.033.086-.07.127-.109.232-.21.44-.45.607-.716.16-.254.277-.535.35-.827a3.31 3.31 0 00.077-.912c-.003-.245-.033-.488-.076-.728-.068-.381-.173-.754-.287-1.124-.105-.337-.22-.67-.337-1.003-.27-.769-.568-1.53-.81-2.306-.135-.43-.242-.87-.293-1.317-.03-.263-.037-.528-.003-.79.026-.21.082-.42.18-.608.075-.144.182-.271.313-.365.227-.165.503-.255.78-.306.353-.064.711-.084 1.069-.067.443.021.885.077 1.32.168.397.083.79.193 1.166.348.203.083.407.175.577.316.097.08.183.176.247.286.063.109.1.232.113.357.022.21-.016.42-.075.62-.18.613-.478 1.183-.77 1.749l-.145.278c-.106.209-.215.414-.32.621-.111.217-.22.435-.32.658a.274.274 0 00-.027.121c.006.087.063.162.12.223.112.12.276.142.424.133.387-.023.77-.114 1.141-.23a8.86 8.86 0 001.335-.499c.324-.14.644-.29.955-.454.298-.157.594-.321.87-.512.163-.112.321-.233.465-.367.089-.083.173-.174.237-.28.047-.08.08-.168.093-.26a.674.674 0 00-.022-.26 1.193 1.193 0 00-.112-.292 2.668 2.668 0 00-.38-.52 5.41 5.41 0 00-.537-.512 8.37 8.37 0 00-1.257-.894 11.68 11.68 0 00-1.538-.772c-.563-.234-1.146-.426-1.738-.58-.664-.172-1.343-.298-2.026-.388-.58-.077-1.165-.12-1.75-.137-.536-.015-1.073-.004-1.609.029-.49.03-.98.078-1.466.153-.377.058-.752.13-1.122.225-.282.073-.566.157-.823.295a1.176 1.176 0 00-.471.44 1.108 1.108 0 00-.11.277.932.932 0 00.017.489c.043.15.121.287.212.412.15.205.348.364.554.507.193.135.4.25.614.35.364.171.75.297 1.14.396.468.118.945.205 1.424.271.543.076 1.09.128 1.637.163.514.032 1.028.048 1.543.047.566.001 1.132-.01 1.697-.047.532-.035 1.063-.093 1.59-.177.47-.075.937-.175 1.392-.314.318-.097.636-.211.932-.37.146-.078.287-.172.407-.286.094-.09.173-.198.232-.317.074-.15.113-.319.11-.488a.982.982 0 00-.096-.409 1.326 1.326 0 00-.155-.253 2.23 2.23 0 00-.271-.298c-.23-.217-.494-.399-.774-.544-.387-.202-.802-.355-1.222-.484-.494-.151-1-.271-1.511-.364-.591-.108-1.188-.189-1.788-.24-.65-.056-1.302-.082-1.954-.081-.703 0-1.406.032-2.105.111-.571.065-1.14.162-1.694.319a6.083 6.083 0 00-.839.296c-.173.077-.343.17-.487.297-.075.066-.146.144-.192.236-.037.075-.056.159-.055.243 0 .106.03.21.069.307.067.166.186.303.314.424.258.243.566.427.884.577.405.191.832.334 1.262.45.57.153 1.152.264 1.738.343.681.093 1.368.146 2.054.175.753.032 1.506.025 2.258-.012.71-.035 1.42-.106 2.12-.224.578-.097 1.151-.227 1.7-.42.335-.118.667-.26.962-.455.151-.1.293-.22.403-.366.067-.09.12-.191.146-.301.026-.11.028-.225.003-.335-.04-.175-.139-.33-.254-.465-.161-.188-.356-.346-.556-.498-.242-.186-.5-.35-.764-.504-.364-.213-.743-.4-1.13-.568-.476-.206-.967-.38-1.464-.536-.576-.18-1.162-.333-1.753-.466-.539-.12-1.083-.224-1.63-.31-.484-.075-.97-.134-1.459-.177-.585-.051-1.17-.075-1.757-.082-.5-.006-1 .008-1.499.034-.433.022-.865.06-1.294.115-.413.053-.825.124-1.23.221-.342.082-.681.182-1.007.315-.233.096-.462.213-.662.369-.113.088-.217.195-.294.32-.06.097-.1.205-.117.317-.021.14-.013.284.017.423.045.207.14.4.262.571.186.261.427.477.683.668.36.27.756.498 1.167.69.52.243 1.064.438 1.615.606.69.21 1.395.374 2.106.498.84.147 1.69.242 2.543.284.762.038 1.525.032 2.287-.018.649-.043 1.296-.12 1.935-.247.472-.094.94-.217 1.382-.404.233-.1.46-.223.654-.385.102-.085.193-.184.263-.298.059-.096.099-.204.108-.318a.634.634 0 00-.064-.314 1.034 1.034 0 00-.216-.294 2.507 2.507 0 00-.341-.278c-.245-.17-.512-.31-.785-.435-.34-.156-.693-.289-1.05-.408-.446-.148-.9-.276-1.359-.387-.543-.132-1.093-.243-1.646-.336-.653-.11-1.311-.196-1.972-.26-.762-.074-1.528-.116-2.294-.127-.647-.01-1.294.008-1.94.05-.523.035-1.044.089-1.56.175-.387.064-.772.148-1.143.28-.217.077-.43.173-.618.306-.11.077-.21.17-.287.279a.752.752 0 00-.126.343.626.626 0 00.039.275c.039.11.106.208.184.295.127.14.284.253.45.349.257.148.537.26.822.35.362.115.734.202 1.109.271.453.082.91.142 1.37.183.553.049 1.109.075 1.665.082.63.008 1.26-.007 1.889-.053.536-.039 1.07-.105 1.594-.213.362-.075.72-.176 1.053-.328.178-.082.349-.184.492-.317.078-.073.148-.158.196-.254.038-.077.058-.163.057-.25a.493.493 0 00-.108-.3 1.054 1.054 0 00-.236-.23 2.54 2.54 0 00-.402-.26c-.179-.096-.367-.177-.559-.25-.264-.1-.535-.183-.809-.258-.363-.1-.73-.188-1.1-.264-.454-.094-.913-.173-1.374-.24-.547-.079-1.096-.14-1.648-.186-.637-.054-1.276-.087-1.916-.098-.588-.01-1.176-.003-1.763.03-.437.025-.874.064-1.307.127-.29.042-.579.096-.86.174a2.88 2.88 0 00-.492.18c-.1.048-.195.11-.273.189a.556.556 0 00-.139.238.457.457 0 00-.014.211.557.557 0 00.098.224c.057.082.131.15.211.21.122.093.26.167.401.232.21.097.43.177.653.245.325.1.657.18.991.248.448.091.9.161 1.355.214.563.066 1.129.107 1.696.128.641.024 1.284.017 1.924-.019.511-.029 1.02-.086 1.521-.184.31-.06.618-.141.906-.272.15-.068.294-.153.418-.26.068-.059.13-.127.176-.203a.477.477 0 00.07-.225.374.374 0 00-.058-.212.601.601 0 00-.152-.172 1.35 1.35 0 00-.247-.163c-.126-.066-.259-.12-.394-.168-.192-.068-.388-.125-.586-.176-.267-.069-.537-.127-.809-.177-.355-.066-.713-.118-1.072-.161-.443-.053-.889-.093-1.335-.12-.546-.033-1.094-.05-1.641-.05-.498.001-.997.018-1.494.055-.36.027-.72.067-1.075.129-.224.04-.447.089-.665.155-.12.037-.239.08-.349.14a.611.611 0 00-.189.158.354.354 0 00-.067.202.298.298 0 00.054.16c.041.058.097.104.157.145.09.062.191.108.294.147.149.056.304.1.46.138.226.056.455.1.685.137.305.05.612.09.92.121.398.04.799.067 1.2.08.475.016.951.016 1.427-.01.372-.02.744-.056 1.111-.117.224-.038.446-.087.66-.162.112-.04.222-.088.321-.154a.485.485 0 00.168-.18.301.301 0 00.034-.17.29.29 0 00-.079-.154.556.556 0 00-.147-.113c-.08-.047-.166-.085-.254-.118-.125-.046-.254-.083-.383-.116-.178-.046-.359-.084-.541-.117-.243-.045-.488-.082-.733-.112-.32-.04-.642-.072-.965-.096-.402-.03-.806-.049-1.21-.057-.363-.007-.727-.006-1.09.013-.26.013-.52.037-.778.071-.165.022-.33.05-.492.089-.097.023-.193.052-.285.09a.417.417 0 00-.157.104.22.22 0 00-.051.118.189.189 0 00.027.11.288.288 0 00.098.095c.058.04.122.07.188.095.094.037.192.066.29.09.14.034.281.062.423.084.192.03.386.053.58.07.256.022.514.035.77.04.303.006.606.002.909-.015.222-.013.444-.035.663-.067.136-.02.271-.045.403-.082a.64.64 0 00.189-.081.246.246 0 00.089-.1.155.155 0 00.01-.094.18.18 0 00-.07-.1.448.448 0 00-.117-.07c-.066-.03-.134-.054-.204-.073-.097-.027-.195-.049-.294-.067-.137-.025-.275-.044-.413-.059-.183-.02-.367-.033-.551-.04-.217-.01-.435-.013-.652-.006-.183.005-.366.017-.548.037-.116.013-.231.03-.345.053-.064.013-.128.03-.19.051-.039.014-.077.03-.112.053a.129.129 0 00-.045.052.09.09 0 00-.003.067.112.112 0 00.048.058c.025.018.052.033.08.046.04.018.081.034.123.047.058.018.118.033.178.046.083.018.166.032.25.043.117.015.235.024.353.03.149.007.298.008.447.003.117-.004.234-.013.35-.027.072-.008.143-.02.214-.035.043-.01.085-.02.126-.035a.166.166 0 00.062-.039.076.076 0 00.02-.037.063.063 0 00-.014-.046.106.106 0 00-.037-.032.286.286 0 00-.062-.027c-.03-.01-.06-.018-.09-.024-.042-.009-.085-.016-.128-.022-.059-.008-.118-.014-.178-.018-.08-.005-.16-.008-.24-.007-.067.001-.133.005-.2.012-.04.004-.081.01-.12.018-.023.005-.046.01-.068.018a.071.071 0 00-.028.02.038.038 0 00-.008.017.033.033 0 00.007.021c.007.009.017.016.027.021l.036.015c.017.006.034.01.051.014.024.005.049.009.073.012.034.004.069.007.103.008.046.002.092.002.137 0 .035-.002.07-.004.104-.01.021-.003.042-.007.062-.012a.093.093 0 00.032-.015.04.04 0 00.012-.014.025.025 0 00.001-.015.03.03 0 00-.014-.016.067.067 0 00-.022-.011c-.011-.004-.023-.007-.035-.01a.302.302 0 00-.051-.008c-.025-.003-.051-.005-.077-.005-.035-.001-.07 0-.104.003-.024.002-.047.005-.07.01-.014.003-.027.006-.04.01-.008.003-.017.006-.024.011a.02.02 0 00-.008.009.013.013 0 00.002.01.02.02 0 00.01.007c.005.003.011.005.017.006.009.002.018.004.027.005l.04.004c.02.002.039.002.059.002.016 0 .032-.001.047-.003.01-.001.02-.003.028-.006a.04.04 0 00.014-.007.015.015 0 00.004-.005.009.009 0 00-.002-.009" />
                            </svg>
                            CodeChef
                        </label>
                        <input
                            type="url"
                            value={codechefUrl}
                            onChange={(e) => setCodechefUrl(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                            placeholder="https://codechef.com/users/username"
                        />
                    </div>

                    {/* GeeksforGeeks */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M21.45 14.315c-.143.28-.334.532-.565.745a3.691 3.691 0 0 1-1.104.695 4.51 4.51 0 0 1-3.116-.016 3.79 3.79 0 0 1-2.135-2.078l3.763-.003a2.4 2.4 0 0 0 .48-.047.865.865 0 0 0 .465-.278c.127-.157.19-.363.19-.618V12.7a.921.921 0 0 0-.19-.618.865.865 0 0 0-.465-.278 2.41 2.41 0 0 0-.48-.047H11.99a.73.73 0 0 1-.513-.213.73.73 0 0 1-.213-.513v-.015a.97.97 0 0 1 .232-.612.97.97 0 0 1 .595-.378 2.11 2.11 0 0 1 .488-.056h5.897c.18 0 .345-.003.495-.01a2.1 2.1 0 0 0 .46-.057.825.825 0 0 0 .37-.198.704.704 0 0 0 .202-.358 2.85 2.85 0 0 0 .042-.564V5.56a.921.921 0 0 0-.19-.618.865.865 0 0 0-.465-.278 2.41 2.41 0 0 0-.48-.047H11.99a5.88 5.88 0 0 0-2.328.455 5.884 5.884 0 0 0-1.934 1.305 6.067 6.067 0 0 0-1.295 1.954 6.19 6.19 0 0 0-.465 2.37c0 .842.157 1.637.47 2.385.313.749.755 1.404 1.327 1.965.571.562 1.247 1.006 2.028 1.335a6.476 6.476 0 0 0 2.495.491h.94a1.25 1.25 0 0 1 .897.377 1.273 1.273 0 0 1 .371.913v.024c0 .218-.05.422-.15.611a1.25 1.25 0 0 1-.41.465 1.37 1.37 0 0 1-.603.243 5.01 5.01 0 0 1-.695.047H2.545a.865.865 0 0 0-.465.278.921.921 0 0 0-.19.618v.015c0 .255.063.461.19.618.127.157.285.261.465.278.163.03.326.047.48.047h9.433a7.23 7.23 0 0 0 2.759-.525 7.038 7.038 0 0 0 2.255-1.473 6.97 6.97 0 0 0 1.526-2.185 6.622 6.622 0 0 0 .558-2.721 6.51 6.51 0 0 0-.107-1.17z" />
                            </svg>
                            GeeksforGeeks
                        </label>
                        <input
                            type="url"
                            value={gfgUrl}
                            onChange={(e) => setGfgUrl(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                            placeholder="https://geeksforgeeks.org/user/username"
                        />
                    </div>

                    {/* HackerRank */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0c1.285 0 9.75 4.886 10.392 6 .645 1.115.645 10.885 0 12S13.287 24 12 24s-9.75-4.885-10.395-6c-.641-1.115-.641-10.885 0-12C2.25 4.886 10.715 0 12 0zm2.295 6.799c-.141 0-.258.115-.258.258v3.875H9.963V6.908h.701a.136.136 0 0 0 .094-.229l-1.97-2.022a.136.136 0 0 0-.191 0l-1.97 2.022a.136.136 0 0 0 .094.229h.701v10.035c0 .143.115.258.258.258h1.97c.143 0 .258-.115.258-.258v-3.876h4.074v4.026h-.701a.136.136 0 0 0-.094.229l1.97 2.022a.136.136 0 0 0 .191 0l1.97-2.022a.136.136 0 0 0-.094-.229h-.701V6.908a.26.26 0 0 0-.258-.109h-1.97z" />
                            </svg>
                            HackerRank
                        </label>
                        <input
                            type="url"
                            value={hackerrankUrl}
                            onChange={(e) => setHackerrankUrl(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                            placeholder="https://hackerrank.com/username"
                        />
                    </div>
                </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    {error}
                </div>
            )}
            {success && (
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                    Profile updated successfully!
                </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <Link
                    href="/profile"
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Profile
                </Link>

                <button
                    type="submit"
                    disabled={isPending || !!systemIdError}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            Save Changes
                        </>
                    )}
                </button>
            </div>
        </form>
    )
}
