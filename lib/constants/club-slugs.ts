/** URL slug → `clubs.name` in the database (club pages and their past events). */
export const CLUB_SLUG_TO_DB_NAME: Record<string, string> = {
    "technova-main": "Technova Main",
    "ai-robotics": "AI & Robotics",
    "aws-cloud": "AWS Cloud",
    "cyber-pirates": "CyberPirates",
    "datapool": "Datapool",
    "game-drifters": "Game Drifters",
    "gdg": "GDG on Campus",
    "github": "GitHub Club",
    "pixelance": "PiXelance"
}

/** `clubs.name` → logo file in /public, used when a club hasn't uploaded one in Club Management. */
export const CLUB_LOGO_FILES: Record<string, string> = {
    "Technova Main": "/assets/logo/technova.png",
    "Technova Executives": "/assets/logo/technova.png",
    "AI & Robotics": "/assets/logo/AI_&_Robotics_logo.png",
    "AWS Cloud": "/assets/logo/awscc.png",
    "CyberPirates": "/assets/logo/cyberpirates.png",
    "Datapool": "/assets/logo/datapool.png",
    "Game Drifters": "/assets/logo/Game Drifters.png",
    "GDG on Campus": "/assets/logo/gdg_on_campus.jpg",
    "GitHub Club": "/assets/logo/github.png",
    "PiXelance": "/assets/logo/pixelance_logo.png",
}
