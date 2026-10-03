/**
 * Team Member Photo Mappings
 * Maps member names to their photo paths in the public/assets/team directory
 */

// Helper to normalize names for matching
export function normalizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

// Slug to folder mapping
const CLUB_FOLDER_MAP: Record<string, string> = {
    "cyber-pirates": "cyberpirates",
    "cyberpirates": "cyberpirates",
    "ai-robotics": "ai_robotics",
    "ai & robotics": "ai_robotics",
    "datapool": "datapool",
    "pixelance": "pixelance",
    "github": "gitHub_club",
    "github club": "gitHub_club",
    "game-drifters": "game_drifters",
    "game drifters": "game_drifters",
    "technova-main": "technova_main",
    "technova main": "technova_main",
    "technova executives": "technova_main",
    "gdg-on-campus": "gdg_on_campus",
    "gdg on campus": "gdg_on_campus",
    "gdg": "gdg_on_campus",
}

// Member name to photo filename mapping
// Key: normalized name (or first name), Value: { folder, filename }
// Includes full names and common variations
export const MEMBER_PHOTOS: Record<string, { folder: string; filename: string }> = {
    // Technova Main / Executives
    "mohammad_sameer": { folder: "technova_main", filename: "mohammad_sameer.png" },
    "sameer": { folder: "technova_main", filename: "mohammad_sameer.png" },
    "masood_aslam": { folder: "technova_main", filename: "masood_aslam.png" },
    "masood": { folder: "technova_main", filename: "masood_aslam.png" },
    "dushyant_prajapati": { folder: "technova_main", filename: "dushyant_prajapati.jpg" },

    // CyberPirates
    "aditya_dhanraj": { folder: "cyberpirates", filename: "aditya_dhanraj.jpg" },
    "aditya_kumar_singh": { folder: "cyberpirates", filename: "aditya_kumar_singh.jpg" },
    "anusha_bhardwaj": { folder: "cyberpirates", filename: "anusha_bhardwaj.jpg" },
    "anusha": { folder: "cyberpirates", filename: "anusha_bhardwaj.jpg" },
    "ishika_dhiman": { folder: "cyberpirates", filename: "ishika_dhiman.jpg" },
    "ishika": { folder: "cyberpirates", filename: "ishika_dhiman.jpg" },
    "miriam_victoria": { folder: "cyberpirates", filename: "miriam_victoria.jpg" },
    "miriam": { folder: "cyberpirates", filename: "miriam_victoria.jpg" },
    "ritesh_sharma": { folder: "cyberpirates", filename: "ritesh_sharma.jpg" },
    "ritesh": { folder: "cyberpirates", filename: "ritesh_sharma.jpg" },
    "sneha_mishra": { folder: "cyberpirates", filename: "sneha_mishra.jpg" },
    "sneha": { folder: "cyberpirates", filename: "sneha_mishra.jpg" },

    // Datapool
    "al_dua_khan": { folder: "datapool", filename: "al_dua_khan.png" },
    "al_dua": { folder: "datapool", filename: "al_dua_khan.png" },
    "dushyant": { folder: "datapool", filename: "dushyant.png" },
    "dushyant_singh": { folder: "datapool", filename: "dushyant.png" },
    "dushyant_kumar": { folder: "datapool", filename: "dushyant.png" },
    "rahul_gupta": { folder: "datapool", filename: "rahul_gupta.png" },
    "rahul": { folder: "datapool", filename: "rahul_gupta.png" },
    "rajeev_gupta": { folder: "datapool", filename: "rajeev_gupta.png" },
    "rajeev": { folder: "datapool", filename: "rajeev_gupta.png" },
    "siya_rathi": { folder: "datapool", filename: "siya_rathi.png" },
    "siya": { folder: "datapool", filename: "siya_rathi.png" },
    "tanisha": { folder: "datapool", filename: "tanisha.png" },
    "tanisha_singh": { folder: "datapool", filename: "tanisha.png" },
    "tanisha_sharma": { folder: "datapool", filename: "tanisha.png" },

    // Pixelance
    "krishna_narula": { folder: "pixelance", filename: "krishna_narula.png" },
    "abhijit_dutta": { folder: "pixelance", filename: "abhijit_dutta.png" },
    "abhijit": { folder: "pixelance", filename: "abhijit_dutta.png" },
    "christopher_yumnam": { folder: "pixelance", filename: "christopher_yumnam.jpg" },
    "christopher": { folder: "pixelance", filename: "christopher_yumnam.jpg" },
    "daxita": { folder: "pixelance", filename: "daxita.png" },
    "kavay_dahiya": { folder: "pixelance", filename: "kavay_dahiya.png" },
    "kavay": { folder: "pixelance", filename: "kavay_dahiya.png" },
    "kavya_dahiya": { folder: "pixelance", filename: "kavay_dahiya.png" },
    "kavya": { folder: "pixelance", filename: "kavay_dahiya.png" },
    "keshav_grover": { folder: "pixelance", filename: "keshav_grover.png" },
    "keshav": { folder: "pixelance", filename: "keshav_grover.png" },
    "madwesha": { folder: "pixelance", filename: "madwesha.png" },
    "madhwesha": { folder: "pixelance", filename: "madwesha.png" },
    "madhwesha_singh": { folder: "pixelance", filename: "madwesha.png" },
    "madhwesha_sharma": { folder: "pixelance", filename: "madwesha.png" },
    "madwesha_r": { folder: "pixelance", filename: "madwesha.png" },
    "madhwesha_r": { folder: "pixelance", filename: "madwesha.png" },
    "navya_tyagi": { folder: "pixelance", filename: "navya_tyagi.png" },
    "navya": { folder: "pixelance", filename: "navya_tyagi.png" },
    "rishiyendra_kumar": { folder: "pixelance", filename: "rishiyendra_kumar.png" },
    "rishiyendra": { folder: "pixelance", filename: "rishiyendra_kumar.png" },
    "sarthak_choudhary": { folder: "pixelance", filename: "sarthak_choudhary.png" },
    "sarthak": { folder: "pixelance", filename: "sarthak_choudhary.png" },
    "shakhawat_ansari": { folder: "pixelance", filename: "shakhawat.png" },
    "shakhawat": { folder: "pixelance", filename: "shakhawat.png" },
    "shivansh_tiwari": { folder: "pixelance", filename: "shivansh_tiwari.png" },
    "shivansh": { folder: "pixelance", filename: "shivansh_tiwari.png" },
    "swastik_garg": { folder: "pixelance", filename: "swastik_garg.png" },
    "swastik": { folder: "pixelance", filename: "swastik_garg.png" },


    // AI & Robotics
    "manya": { folder: "ai_robotics", filename: "Manya.JPG" },
    "manya_singh": { folder: "ai_robotics", filename: "Manya.JPG" },
    "manya_sharma": { folder: "ai_robotics", filename: "Manya.JPG" },
    "muskan": { folder: "ai_robotics", filename: "Muskan.jpg" },
    "muskan_singh": { folder: "ai_robotics", filename: "Muskan.jpg" },
    "muskan_sharma": { folder: "ai_robotics", filename: "Muskan.jpg" },
    "pratham": { folder: "ai_robotics", filename: "Pratham_.jpg" },
    "pratham_singh": { folder: "ai_robotics", filename: "Pratham_.jpg" },
    "pratham_kumar": { folder: "ai_robotics", filename: "Pratham_.jpg" },
    "pratham_sharma": { folder: "ai_robotics", filename: "Pratham_.jpg" },
    "sapna": { folder: "ai_robotics", filename: "SAPNA.jpg" },
    "sapna_singh": { folder: "ai_robotics", filename: "SAPNA.jpg" },
    "sapna_sharma": { folder: "ai_robotics", filename: "SAPNA.jpg" },
    "preeti_pal": { folder: "ai_robotics", filename: "preeti_pal.png" },
    "preeti": { folder: "ai_robotics", filename: "preeti_pal.png" },
    "saurav": { folder: "ai_robotics", filename: "saurav.jpg" },
    "saurav_singh": { folder: "ai_robotics", filename: "saurav.jpg" },
    "saurav_kumar": { folder: "ai_robotics", filename: "saurav.jpg" },
    "saurav_sharma": { folder: "ai_robotics", filename: "saurav.jpg" },

    // GitHub Club
    "deepanshu": { folder: "gitHub_club", filename: "Deepanshu.jpg" },
    "deepanshu_singh": { folder: "gitHub_club", filename: "Deepanshu.jpg" },
    "deepanshu_kumar": { folder: "gitHub_club", filename: "Deepanshu.jpg" },
    "deepanshu_sharma": { folder: "gitHub_club", filename: "Deepanshu.jpg" },
    "shubham": { folder: "gitHub_club", filename: "Shubham.png" },
    "shubham_singh": { folder: "gitHub_club", filename: "Shubham.png" },
    "shubham_kumar": { folder: "gitHub_club", filename: "Shubham.png" },
    "shubham_sharma": { folder: "gitHub_club", filename: "Shubham.png" },
    "shubham_shukla": { folder: "gitHub_club", filename: "Shubham.png" },
    "suryansh": { folder: "gitHub_club", filename: "Suryansh.JPG" },
    "suryansh_singh": { folder: "gitHub_club", filename: "Suryansh.JPG" },
    "suryansh_kumar": { folder: "gitHub_club", filename: "Suryansh.JPG" },
    "suryansh_sharma": { folder: "gitHub_club", filename: "Suryansh.JPG" },
    "suryansh_rai": { folder: "gitHub_club", filename: "Suryansh.JPG" },
    "arnima": { folder: "gitHub_club", filename: "arnima.jpg" },
    "arnima_singh": { folder: "gitHub_club", filename: "arnima.jpg" },
    "arnima_sharma": { folder: "gitHub_club", filename: "arnima.jpg" },
    "arnima_chakravarty": { folder: "gitHub_club", filename: "arnima.jpg" },
    "parikshit": { folder: "gitHub_club", filename: "parikshit.png" },
    "parikshit_singh": { folder: "gitHub_club", filename: "parikshit.png" },
    "parikshit_sharma": { folder: "gitHub_club", filename: "parikshit.png" },
    "tanisha_mittal": { folder: "gitHub_club", filename: "tanisha_mittal.jpg" },

    // GDG On Campus
    "narmada_kaushik": { folder: "gdg_on_campus", filename: "narmada_kaushik.jpg" },
    "narmada": { folder: "gdg_on_campus", filename: "narmada_kaushik.jpg" },
    "aditya_singh": { folder: "gdg_on_campus", filename: "aditya_singh.png" },
    "aditya": { folder: "gdg_on_campus", filename: "aditya_singh.png" },
    "vansh_chauhan": { folder: "gdg_on_campus", filename: "vansh_chauhan.jpg" },
    "vansh": { folder: "gdg_on_campus", filename: "vansh_chauhan.jpg" },
    "yash_kumar_choudhary": { folder: "gdg_on_campus", filename: "yash_kumar_choudhary.jpg" },
    "yash_kumar": { folder: "gdg_on_campus", filename: "yash_kumar_choudhary.jpg" },
    "yash": { folder: "gdg_on_campus", filename: "yash_kumar_choudhary.jpg" },
}

/**
 * Get the photo path for a member given their name
 * Uses multiple matching strategies:
 * 1. Exact normalized match
 * 2. First name only match
 * 3. First two names match (for names like "Al Dua Khan")
 * @param memberName - The name of the member
 * @returns The photo path or undefined if not found
 */
export function getMemberPhotoPath(memberName: string): string | undefined {
    const normalized = normalizeName(memberName)

    // Try exact match first
    let photo = MEMBER_PHOTOS[normalized]
    if (photo) {
        return `/assets/team/${photo.folder}/${photo.filename}`
    }

    // Try first name only (for single-word photo files like Manya.JPG)
    const nameParts = normalized.split('_')
    if (nameParts.length > 1) {
        const firstName = nameParts[0]
        photo = MEMBER_PHOTOS[firstName]
        if (photo) {
            return `/assets/team/${photo.folder}/${photo.filename}`
        }

        // Try first two parts (for names like "Al Dua Khan" -> "al_dua")
        if (nameParts.length >= 2) {
            const firstTwo = nameParts.slice(0, 2).join('_')
            photo = MEMBER_PHOTOS[firstTwo]
            if (photo) {
                return `/assets/team/${photo.folder}/${photo.filename}`
            }
        }
    }

    return undefined
}

/**
 * Get club folder name from slug or club name
 */
export function getClubFolder(slugOrName: string): string | undefined {
    const normalized = slugOrName.toLowerCase()
    return CLUB_FOLDER_MAP[normalized]
}
