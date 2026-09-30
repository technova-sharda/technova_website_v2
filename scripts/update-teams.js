require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

const TEAMS_DATA = {
  "PiXelance": [
    { name: "Mohd. Tamzeed", role: "Club Lead", email: "2026000090.mohd@ug.sharda.ac.in", phone: "8423745503" },
    { name: "Daxita", role: "Club Co-Lead", email: "2024342783.daxita@ug.sharda.ac.in", phone: "7835890360" },
    { name: "Harshit", role: "Coordinators", email: "2025368857.harshit@ug.sharda.ac.in", phone: "9058624242" },
    { name: "Aviral", role: "Coordinators", email: "2025495898.aviral@ug.sharda.ac.in", phone: "7302911262" },
    { name: "Jyotshna Rajput", role: "Coordinators", email: "2025433875.jyotshna@ug.sharda.ac.in", phone: "8920292122" },
    { name: "Sanzit Kumar Shil (Amit)", role: "Coordinators", email: "2025826075.sanzit@ug.sharda.ac.in", phone: "7364015499" },
    { name: "Arush singh", role: "Coordinators", email: "2025480417.arush@ug.sharda.ac.in", phone: "9695001035" },
    { name: "Sreeja", role: "Coordinators", email: "2025140432.sreeja@ug.sharda.ac.in", phone: "7001590090" },
    { name: "Syed Hasan Jafar", role: "Coordinators", email: "2025544167.syed@ug.sharda.ac.in", phone: "9810530961" },
    { name: "Tejaswi", role: "Coordinators", email: null, phone: null },
    { name: "Ujjawal", role: "Coordinators", email: "2025438574.ujjawal@ug.sharda.ac.in", phone: "9810183752" }
  ],
  "Technova Executives": [
    { name: "Shivangi Joshi", role: "President", email: "2024381714.shivangi@ug.sharda.ac.in", phone: "7292010452" },
    { name: "Saquib Shamshi", role: "Vice President", email: "2025370758.saquib@ug.sharda.ac.in", phone: "8178812402" },
    { name: "Lavanya Bharadwaj", role: "Secretary", email: "2025280007.lavanya@ug.sharda.ac.in", phone: "7358108566" },
    { name: "Salwa Rashid", role: "Joint Secretary", email: "2025322555.salwa@ug.sharda.ac.in", phone: "8929018817" },
    { name: "Aishwarya Srivastava", role: "PR Head", email: "2025218235.aishwarya@ug.sharda.ac.in", phone: "8826009850" },
    { name: "Tanvi Puri", role: "PR Co-Head", email: "2025480655.tanvi@ug.sharda.ac.in", phone: "7268907208" },
    { name: "Sanzit Kumar Shil", role: "Creative head", email: "2025826075.sanzit@ug.sharda.ac.in", phone: "7364015499" },
    { name: "Dushyant Prajapati", role: "Tech lead", email: "2025273581.dushyant@ug.sharda.ac.in", phone: "8882236416" }
  ],
  "AI & Robotics": [
    { name: "Abhishek Pandey", role: "Lead", email: "2024156131.abhishek@ug.sharda.ac.in", phone: "7088219552" },
    { name: "Aryan Raj Shrivastava", role: "Co-Lead", email: "2025147380.aryan@ug.sharda.ac.in", phone: "9939999293" },
    { name: "PRATIBHA PANCHAL", role: "Coordinator", email: "2025469214.pratibha@ug.sharda.ac.in", phone: "9910733379" },
    { name: "Vanisha Bansal", role: "Coordinator", email: "2025245945.vanisha@ug.sharda.ac.in", phone: "8931036655" },
    { name: "Preeti Goyal", role: "Coordinator", email: "2025534623.preeti@ug.sharda.ac.in", phone: "8178235655" }
  ],
  "Game Drifters": [
    { name: "Aarav Kashyap", role: "Club Lead", email: "2024468363.aarav@ug.sharda.ac.in", phone: "7836809633" },
    { name: "Samarth Varshney", role: "Club Co-Lead", email: "2025251026.samarth@ug.sharda.ac.in", phone: "9837545149" },
    { name: "Madhav Sharma", role: "Content Head", email: "2025321303.madhav@ug.sharda.ac.in", phone: "90278 95050" },
    { name: "Sparsh Yadav", role: "Co-ordinator", email: "2025309435.sparsh@ug.sharda.ac.in", phone: "79068 21420" },
    { name: "Apurrv Semwal", role: "Co-ordinator", email: "2024365054.apurrv@ug.sharda.ac.in", phone: "8595792608" },
    { name: "Aadya Sharma", role: "Graphic Designer", email: "2026304439.aadya@ug.sharda.ac.in", phone: "9289213888" },
    { name: "Kushagra Chaddha", role: "Game Developer", email: "2026205716.kushagra@ug.sharda.ac.in", phone: "85957 87446" }
  ],
  "GitHub Club": [
    { name: "Tanmoy Saha", role: "Club Lead", email: "2025496217.tanmoy@ug.sharda.ac.in", phone: "9608987621" },
    { name: "Vishnu S. Tripathi", role: "Club Co-Lead", email: "2025404134.vishnu@ug.sharda.ac.in", phone: "6387682886" },
    { name: "Somsubhra Chatterjee", role: "Technical Head", email: "2025354080.somsubhra@ug.sharda.ac.in", phone: "798210771" },
    { name: "Abhimanyu", role: "Projects & Operations Lead", email: "2025385596.abhimanyu@ug.sharda.ac.in", phone: "7037759956" },
    { name: "Prerna Shrivastava", role: "Editorial Head", email: "2026227880.prerna@ug.sharda.ac.in", phone: "7463942884" },
    { name: "Ankit", role: "PR Head", email: "2026173989.ankit@ug.sharda.ac.in", phone: "9434584595" }
  ],
  "CyberPirates": [
    { name: "Pranav Chauhan", role: "Club Lead", email: "2025273108.pranav@ug.sharda.ac.in", phone: "7599154318" },
    { name: "Shriyanka Patra", role: "Club Co-Lead", email: "2025275120.shriyanka@ug.sharda.ac.in", phone: "9124610509" },
    { name: "Ishika Singh", role: "Content Writer", email: "2025260155.ishika@ug.sharda.ac.in", phone: "8860361101" },
    { name: "Mohammad Rayyan", role: "Overall Coordinator", email: "2025233496.mohammad@ug.sharda.ac.in", phone: "8448614289" },
    { name: "Suwarna Rejey", role: "Creative head", email: "2025527588.suwarna@ug.sharda.ac.in", phone: "9873267252" },
    { name: "Nandini Kardam", role: "PR Head", email: "2025210962.nandini@ug.sharda.ac.in", phone: "9818588691" }
  ],
  "Datapool": [
    { name: "Ritik Raj", role: "Club Lead", email: "2024261197.ritik@ug.sharda.ac.in", phone: "6202011783" },
    { name: "Shruti Chauhan", role: "Club Co-Lead", email: "2025446555.shruti@ug.sharda.ac.in", phone: "9771979109" },
    { name: "Astuti Pandey", role: "Editorial Lead", email: "2025225548.astuti@ug.sharda.ac.in", phone: "9318407799" },
    { name: "Angel Malaiya", role: "Technical Head", email: "2025222124.angel@ug.sharda.ac.in", phone: "9044957035" },
    { name: "Suwarna Kumari", role: "PR Head", email: "2024368153.suwarna@ug.sharda.ac.in", phone: "7739612981" },
    { name: "Avni Vashist", role: "Projects & Operations Lead", email: "2024205370.avni@ug.sharda.ac.in", phone: "7982154930" }
  ]
};

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    
    console.log("Deleting AWS Cloud club...");
    await client.query("DELETE FROM clubs WHERE name = 'AWS Cloud'");
    
    for (const [clubName, members] of Object.entries(TEAMS_DATA)) {
      console.log(`Processing ${clubName}...`);
      
      let actualClubName = clubName;
      let res = await client.query("SELECT id FROM clubs WHERE name = $1", [actualClubName]);
      
      if (res.rows.length === 0) {
        if (actualClubName === "Technova Executives") {
           res = await client.query("SELECT id FROM clubs WHERE name = 'Technova Main'");
           if (res.rows.length === 0) {
             console.log("Could not find club for", actualClubName);
             continue;
           }
        } else {
           console.log("Could not find club for", actualClubName);
           continue;
        }
      }
      const clubId = res.rows[0].id;

      await client.query("DELETE FROM club_members WHERE club_id = $1", [clubId]);

      for (const member of members) {
        await client.query(
          "INSERT INTO club_members (club_id, name, role, email, phone) VALUES ($1, $2, $3, $4, $5)",
          [clubId, member.name, member.role, member.email, member.phone]
        );
      }
      console.log(`Inserted ${members.length} members for ${clubName}.`);
    }

    console.log("All done!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

main();
