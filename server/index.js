import { createApp } from "./app.js";

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const port = Number(process.env.PORT ?? 3001);
const app = await createApp();
app.listen(port, () => {
  console.log(`CivicVoice API listening on http://localhost:${port}`);
});
