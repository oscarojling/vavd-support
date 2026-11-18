// Hanterar inloggningsanvändare i .env.local.
//
//   npm run anvandare -- <namn> <lösenord>     skapa eller byt lösenord
//   npm run anvandare -- --ta-bort <namn>      ta bort
//   npm run anvandare -- --lista               visa vilka som finns
//
// Skapar också AUTH_SECRET om den saknas. Starta om servern efteråt.
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const FIL = ".env.local";
let text = existsSync(FIL) ? readFileSync(FIL, "utf-8") : "";

const lasVar = (nyckel) => text.match(new RegExp(`^${nyckel}=(.*)$`, "m"))?.[1]?.trim() ?? "";
const sattVar = (nyckel, varde) => {
  const rad = `${nyckel}=${varde}`;
  text = new RegExp(`^${nyckel}=`, "m").test(text)
    ? text.replace(new RegExp(`^${nyckel}=.*$`, "m"), rad)
    : `${text.replace(/\n*$/, "\n")}${rad}\n`;
};

const anvandare = new Map(
  lasVar("ANVANDARE")
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => [p.split(":")[0], p]),
);

const [forsta, andra] = process.argv.slice(2);

if (forsta === "--lista") {
  console.log(anvandare.size ? [...anvandare.keys()].join("\n") : "Inga användare än.");
  process.exit(0);
}

if (forsta === "--ta-bort") {
  if (!anvandare.delete(andra?.toLowerCase())) {
    console.error(`Hittade ingen användare som heter ${andra}.`);
    process.exit(1);
  }
  console.log(`Tog bort ${andra}.`);
} else {
  const namn = forsta?.trim().toLowerCase();
  const losenord = andra;
  if (!namn || !losenord || /[:;\s]/.test(namn)) {
    console.error("Användning: npm run anvandare -- <namn> <lösenord>   (namnet får inte innehålla : ; eller mellanslag)");
    process.exit(1);
  }
  if (losenord.length < 8) {
    console.error("Välj ett lösenord på minst 8 tecken.");
    process.exit(1);
  }
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(losenord, salt, 32).toString("hex");
  const fanns = anvandare.has(namn);
  anvandare.set(namn, `${namn}:${salt}:${hash}`);
  console.log(fanns ? `Bytte lösenord för ${namn}.` : `Skapade användaren ${namn}.`);
}

sattVar("ANVANDARE", [...anvandare.values()].join(";"));
if (lasVar("AUTH_SECRET").length < 32) {
  sattVar("AUTH_SECRET", randomBytes(32).toString("hex"));
  console.log("Skapade AUTH_SECRET.");
}
writeFileSync(FIL, text);
console.log(`Sparat i ${FIL}. Starta om servern (Ctrl + C, sedan npm run dev) för att det ska gälla.`);
