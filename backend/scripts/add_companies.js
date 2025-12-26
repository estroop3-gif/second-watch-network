const { Client } = require("pg");

const client = new Client({
  host: "swn-database.c0vossgkunoa.us-east-1.rds.amazonaws.com",
  port: 5432,
  database: "secondwatchnetwork",
  user: "swn_admin",
  password: "I6YvLh4FIUj2Wp40XeJ0mJVP",
  ssl: { rejectUnauthorized: false }
});

// Major production companies with logos
const companies = [
  // Major Studios
  { name: "Warner Bros. Pictures", slug: "warner-bros", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Warner_Bros_logo.svg/200px-Warner_Bros_logo.svg.png", is_verified: true },
  { name: "Universal Pictures", slug: "universal", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Universal_Pictures_2021_Logo.svg/200px-Universal_Pictures_2021_Logo.svg.png", is_verified: true },
  { name: "Paramount Pictures", slug: "paramount", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Paramount_Pictures_2022_%28Blue%29.svg/200px-Paramount_Pictures_2022_%28Blue%29.svg.png", is_verified: true },
  { name: "Walt Disney Pictures", slug: "disney-pictures", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Walt_Disney_Pictures_2011_logo.svg/200px-Walt_Disney_Pictures_2011_logo.svg.png", is_verified: true },
  { name: "Sony Pictures", slug: "sony-pictures", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Sony_Pictures_Television_logo.svg/200px-Sony_Pictures_Television_logo.svg.png", is_verified: true },
  { name: "20th Century Studios", slug: "20th-century", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/20th_Century_Studios_logo.svg/200px-20th_Century_Studios_logo.svg.png", is_verified: true },
  { name: "Lionsgate", slug: "lionsgate", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Lionsgate.svg/200px-Lionsgate.svg.png", is_verified: true },
  { name: "MGM", slug: "mgm", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/MGM_logo.svg/200px-MGM_logo.svg.png", is_verified: true },

  // Disney Subsidiaries
  { name: "Marvel Studios", slug: "marvel-studios", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Marvel_Logo.svg/200px-Marvel_Logo.svg.png", is_verified: true },
  { name: "Lucasfilm", slug: "lucasfilm", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Lucasfilm_logo.svg/200px-Lucasfilm_logo.svg.png", is_verified: true },
  { name: "Pixar", slug: "pixar", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Pixar_logo.svg/200px-Pixar_logo.svg.png", is_verified: true },
  { name: "Searchlight Pictures", slug: "searchlight", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Searchlight_Pictures_logo.svg/200px-Searchlight_Pictures_logo.svg.png", is_verified: true },

  // TV Production Studios
  { name: "ABC Studios", slug: "abc-studios", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/ABC_Signature_2020.svg/200px-ABC_Signature_2020.svg.png", is_verified: true },
  { name: "CBS Studios", slug: "cbs-studios", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/CBS_Studios_logo.svg/200px-CBS_Studios_logo.svg.png", is_verified: true },
  { name: "NBCUniversal Television", slug: "nbcuniversal-tv", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/NBCUniversal_Television_2020.svg/200px-NBCUniversal_Television_2020.svg.png", is_verified: true },
  { name: "Warner Bros. Television", slug: "warner-bros-tv", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Warner_Bros._Television_Studios_logo.svg/200px-Warner_Bros._Television_Studios_logo.svg.png", is_verified: true },
  { name: "Sony Pictures Television", slug: "sony-tv", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Sony_Pictures_Television_logo.svg/200px-Sony_Pictures_Television_logo.svg.png", is_verified: true },

  // Animation Studios
  { name: "DreamWorks Animation", slug: "dreamworks", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/DreamWorks_Animation_Logo.svg/200px-DreamWorks_Animation_Logo.svg.png", is_verified: true },
  { name: "Illumination", slug: "illumination", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Illumination_logo_2017.svg/200px-Illumination_logo_2017.svg.png", is_verified: true },
  { name: "Blue Sky Studios", slug: "blue-sky", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Blue_Sky_Studios_logo.svg/200px-Blue_Sky_Studios_logo.svg.png", is_verified: true },
  { name: "Laika", slug: "laika", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Laika_logo.svg/200px-Laika_logo.svg.png", is_verified: true },

  // Independent Studios
  { name: "A24", slug: "a24", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/A24_Logo.svg/200px-A24_Logo.svg.png", is_verified: true },
  { name: "Focus Features", slug: "focus-features", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Focus_Features_logo_2.svg/200px-Focus_Features_logo_2.svg.png", is_verified: true },
  { name: "Neon", slug: "neon", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Neon_%28company%29_logo.svg/200px-Neon_%28company%29_logo.svg.png", is_verified: true },
  { name: "Blumhouse Productions", slug: "blumhouse", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Blumhouse_Productions_logo.svg/200px-Blumhouse_Productions_logo.svg.png", is_verified: true },

  // Streaming Production Arms
  { name: "Netflix", slug: "netflix", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Netflix_logo.svg/200px-Netflix_logo.svg.png", is_verified: true },
  { name: "Amazon Studios", slug: "amazon-studios", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Amazon_Studios_logo.svg/200px-Amazon_Studios_logo.svg.png", is_verified: true },
  { name: "Apple TV+ Studios", slug: "apple-tv", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Apple_TV_Plus_Logo.svg/200px-Apple_TV_Plus_Logo.svg.png", is_verified: true },
  { name: "HBO Films", slug: "hbo-films", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/HBO_logo.svg/200px-HBO_logo.svg.png", is_verified: true },
  { name: "Hulu Originals", slug: "hulu", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Hulu_Logo.svg/200px-Hulu_Logo.svg.png", is_verified: true },

  // Major Production Companies
  { name: "Bad Robot Productions", slug: "bad-robot", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Bad_Robot_Productions_logo.svg/200px-Bad_Robot_Productions_logo.svg.png", is_verified: true },
  { name: "Legendary Entertainment", slug: "legendary", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Legendary_Entertainment_logo.svg/200px-Legendary_Entertainment_logo.svg.png", is_verified: true },
  { name: "Village Roadshow Pictures", slug: "village-roadshow", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Village_Roadshow_Pictures.svg/200px-Village_Roadshow_Pictures.svg.png", is_verified: true },
  { name: "New Line Cinema", slug: "new-line", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/New_Line_Cinema_logo.svg/200px-New_Line_Cinema_logo.svg.png", is_verified: true },
  { name: "Skydance Media", slug: "skydance", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Skydance_Media_logo.svg/200px-Skydance_Media_logo.svg.png", is_verified: true },
  { name: "Amblin Entertainment", slug: "amblin", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Amblin_Entertainment_logo.svg/200px-Amblin_Entertainment_logo.svg.png", is_verified: true },
  { name: "Imagine Entertainment", slug: "imagine", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Imagine_Entertainment_logo.svg/200px-Imagine_Entertainment_logo.svg.png", is_verified: true },
  { name: "Plan B Entertainment", slug: "plan-b", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Plan_B_Entertainment.svg/200px-Plan_B_Entertainment.svg.png", is_verified: true },
  { name: "Happy Madison Productions", slug: "happy-madison", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Happy_Madison_Productions_logo.svg/200px-Happy_Madison_Productions_logo.svg.png", is_verified: true },

  // TV Production Companies
  { name: "Fremantle", slug: "fremantle", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Fremantle_logo.svg/200px-Fremantle_logo.svg.png", is_verified: true },
  { name: "Endemol Shine", slug: "endemol-shine", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Banijay_logo.svg/200px-Banijay_logo.svg.png", is_verified: true },
  { name: "Dick Clark Productions", slug: "dick-clark", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Dick_Clark_Productions_logo.svg/200px-Dick_Clark_Productions_logo.svg.png", is_verified: true },
  { name: "Lorne Michaels Productions", slug: "lorne-michaels", logo_url: null, is_verified: true },
  { name: "Ryan Seacrest Productions", slug: "ryan-seacrest", logo_url: null, is_verified: true },
  { name: "Jerry Bruckheimer Films", slug: "jerry-bruckheimer", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Jerry_Bruckheimer_Films_logo.svg/200px-Jerry_Bruckheimer_Films_logo.svg.png", is_verified: true },

  // International
  { name: "BBC Studios", slug: "bbc-studios", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/BBC_Studios_logo.svg/200px-BBC_Studios_logo.svg.png", is_verified: true },
  { name: "ITV Studios", slug: "itv-studios", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/ITV_Studios_Logo.svg/200px-ITV_Studios_Logo.svg.png", is_verified: true },
  { name: "Gaumont", slug: "gaumont", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Gaumont_logo.svg/200px-Gaumont_logo.svg.png", is_verified: true },
  { name: "Studio Ghibli", slug: "studio-ghibli", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Studio_Ghibli_logo.svg/200px-Studio_Ghibli_logo.svg.png", is_verified: true },
  { name: "Toho", slug: "toho", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Toho_logo.svg/200px-Toho_logo.svg.png", is_verified: true },
  { name: "Pathé", slug: "pathe", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Path%C3%A9_logo.svg/200px-Path%C3%A9_logo.svg.png", is_verified: true },
  { name: "StudioCanal", slug: "studiocanal", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/StudioCanal_Logo.svg/200px-StudioCanal_Logo.svg.png", is_verified: true },
  { name: "Constantin Film", slug: "constantin", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Constantin_Film.svg/200px-Constantin_Film.svg.png", is_verified: true },
  { name: "eOne", slug: "eone", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/EOne_logo.svg/200px-EOne_logo.svg.png", is_verified: true },
];

async function run() {
  await client.connect();

  const existing = await client.query("SELECT slug FROM companies");
  const existingSlugs = new Set(existing.rows.map(r => r.slug));
  console.log("Existing companies:", existing.rows.length);

  const newCompanies = companies.filter(c => !existingSlugs.has(c.slug));
  console.log("New companies to add:", newCompanies.length);

  if (newCompanies.length === 0) {
    console.log("All companies already exist");
    await client.end();
    return;
  }

  let added = 0;
  for (const company of newCompanies) {
    try {
      await client.query(
        "INSERT INTO companies (name, slug, logo_url, is_verified) VALUES ($1, $2, $3, $4)",
        [company.name, company.slug, company.logo_url, company.is_verified]
      );
      added++;
    } catch (e) {
      console.log("Failed to add " + company.name + ": " + e.message);
    }
  }

  console.log("Successfully added", added, "companies");

  const total = await client.query("SELECT COUNT(*) FROM companies");
  console.log("Total companies now:", total.rows[0].count);

  await client.end();
}

run().catch(console.error);
