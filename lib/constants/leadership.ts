/**
 * Technova leadership shown on the website's Leadership page and in the app's
 * Team screen. Edit here and both update.
 */

export const MENTORS = [
    {
        name: "Prof. (Dr.) Sibaram Khara",
        role: "Vice Chancellor",
        message: "It is my immense pleasure to welcome all the first year students to the Sharda University. Vision of Sharda University is to transform students through Outcome-Based Education, driven by research, innovations, modern tools and high-end placements. Sharda University has adopted National Education Policy for the holistic development of students and society together. Sharda University is committed towards academic excellence to provide high-quality education with the help of highly qualified, experienced and focused teaching faculty members. Sharda University adopts modern ICT tools and state-of-the-art infrastructure for imparting quality classroom and laboratory exposure. I wish you all a successful and meaningful period during your education with Department of Computer Science & Engineering, School of Computing Science & Engineering, Sharda University.",
        imagePath: "/assets/leadership/vc.png"
    },
    {
        name: "Prof. (Dr.) Parma Nand",
        role: "Pro-Vice Chancellor",
        message: "The goal of school, guided by the Sharda University vision, is to provide transformational education that produces a skilled workforce of professionals including researchers and innovators of tomorrow with intellectual and technological resources. Our commitment and dedication is to focus on experiential, cooperative and project-based learning that allows our students to continue to adapt, grow and succeed in solving real-world problems. The school provides funding to innovative ideas of the students to develop products, patents and startups. The school has collaborated with IIA, IEA, Greater Noida Authority and other industries to ensure benchmarking of programs and activities. The school thrives to establish a partnership with industries, government organizations & academia, and become a collaborative community of faculties, students, staff and alumni to fulfil societal needs with professional ethics.",
        quote: "By The Students, For The Students and With The Students",
        imagePath: "/assets/leadership/pvc.png"
    },
    {
        name: "Prof. (Dr.) Geetha",
        role: "Dean, SSCE",
        message: "The Technical Society at Sharda School of Computing Science & Engineering is a vibrant platform where innovation meets opportunity. It brings together talented students, encouraging them to explore new technologies, work on real-world projects, and take the lead in initiatives that drive meaningful change. Here, learning goes far beyond the classroom. Students design, execute, and lead projects that challenge their skills and creativity while building teamwork, communication, and problem-solving abilities. Through hackathons, workshops, industrial visits, and collaborations with global industry leaders, members gain exposure to the latest trends and hands-on experience that prepares them for the future. Many have gone on to win national and international competitions, secure prestigious internships, and even launch startups. The Technical Society is a community that transforms potential into achievement and passion into lasting impact.",
        imagePath: "/assets/leadership/dean.png"
    },
    {
        name: "Prof. (Dr.) Jayant Sekhar",
        role: "HoD, Dept. of CSE",
        message: "Computer Science & Engineering is one of the most vibrant department of Sharda University with varieties of specialized programs in Artificial Intelligence & Machine Learning, Cyber Security, Internet of Things, Data Science and Business Intelligence. To have holistic development of students of distinct programs of computer science and to grow the innovative culture among the students, Students Activity Clubs are functional. These clubs are headed by the team of students and they are performing in different dimensions of technology under the guidance of specialized faculty members. Several national and international students are contributing to develop themselves and other peers to excel among the multidisciplinary aspects. The club activities strengthens placements, startups, national/international competitions and research outcomes. We are proud to have high aimed and energetic students club performing exceptionally well since last five years.",
        quote: "Best Wishes to All My Students",
        imagePath: "/assets/leadership/jayant_sekhar.jpg"
    },
    {
        name: "Dr. Rani Astya",
        role: "Faculty Coordinator",
        message: "The Technical Society's philosophy is to foster the all-round development of students. We aim to build an environment of collaborative growth that uplifts the whole community. Each club under the Society hosts events and activities year-round to uncover and nurture the hidden potential of every student. The objective of the students club is to sensitize the technological updating, by enabling the students to participate in various activities like, code-a-thon, hackathons, peer-to-peer learning, entrepreneurial activities, programming challenges, app development, certifications, industrial challenges and many other activities. The students club strengthens the presentation, verbal and communication skills, leadership qualities, confidence and utmost the technical skills among the students.",
        quote: "Nurturing Technical & Interpersonal Skills",
        imagePath: "/assets/leadership/coordinator.png"
    }
]

/** Photos that aren't uploaded through Club Management yet. */
export const TEAM_IMAGE_OVERRIDES: Record<string, string> = {
    "Dushyant Prajapati": "/assets/team/technova_main/dushyant_prajapati.jpg",
}

// Cards pinned to a fixed slot (1-based) on this page, regardless of role sorting
export const PINNED_POSITIONS: Record<string, number> = {}

// Cards placed right after someone with a given role (e.g. after the Joint Secretary)
export const PLACE_AFTER_ROLE: Record<string, string> = {
    "Dushyant Prajapati": "joint secretary",
}

export function applyPinnedPositions<T extends { name: string }>(members: T[]): T[] {
    const afterRole = members.filter(m => m.name in PLACE_AFTER_ROLE)
    members = members.filter(m => !(m.name in PLACE_AFTER_ROLE))
    for (const m of afterRole) {
        const role = PLACE_AFTER_ROLE[m.name]
        const anchor = members.findIndex(x => String((x as any).role ?? "").toLowerCase() === role)
        members.splice(anchor === -1 ? members.length : anchor + 1, 0, m)
    }
    const result = members.filter(m => !(m.name in PINNED_POSITIONS))
    members
        .filter(m => m.name in PINNED_POSITIONS)
        .sort((a, b) => PINNED_POSITIONS[a.name] - PINNED_POSITIONS[b.name])
        .forEach(m => result.splice(Math.min(PINNED_POSITIONS[m.name] - 1, result.length), 0, m))
    return result
}

