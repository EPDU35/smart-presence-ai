import { detectAndPersistAbsences } from "@/database/services/absences.service";

async function main() {
  try {
    const res = await detectAndPersistAbsences(2); // last 2 days
    console.log("Absence detection finished:", res);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
