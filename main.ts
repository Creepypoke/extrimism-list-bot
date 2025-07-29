import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { Bot } from "https://deno.land/x/grammy@v1.37.0/mod.ts";
import { parse } from "https://deno.land/std@0.224.0/csv/mod.ts";

const CSV_URL =
  "https://raw.githubusercontent.com/Creepypoke/extrimism-list-bot/refs/heads/main/list.csv";

// Parse CSV from remote URL
async function parseRemoteCSV(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to fetch CSV: ${response.status}`);
    const csvText = await response.text();
    const records = await parse(csvText, {
      skipFirstRow: true,
      separator: ";",
    });
    console.log(
      `Remote CSV '${url}' loaded, records count:`,
      Array.isArray(records) ? records.length : Object.keys(records).length
    );
    return records;
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error(`Failed to load remote CSV '${url}':`, e.message);
    } else {
      console.error(`Failed to load remote CSV '${url}':`, e);
    }
    return null;
  }
}

const csvRecords = await parseRemoteCSV(CSV_URL);

const token = Deno.env.get("BOT_TOKEN");
if (!token) {
  throw new Error("BOT_TOKEN environment variable is not set.");
}

const bot = new Bot(token);

bot.command("start", (ctx) => ctx.reply("Welcome to the Extrimism List Bot!"));

bot.on("message:text", (ctx) => ctx.reply("You said: " + ctx.message.text));

// Inline mode: return a random record from the CSV
bot.on("inline_query", async (ctx) => {
  if (!csvRecords || !Array.isArray(csvRecords) || csvRecords.length === 0) {
    return ctx.answerInlineQuery([
      {
        type: "article",
        id: "no-data",
        title: "No data available",
        input_message_content: { message_text: "No records found in CSV." },
      },
    ]);
  }
  const random = csvRecords[Math.floor(Math.random() * csvRecords.length)];
  // Format the record for display
  const title = random["Материал"] || Object.values(random)[0] || "Record";
  const date = random["Дата включения"] || Object.values(random)[1] || "";
  const message = `${title}\nДата включения: ${date}`;
  await ctx.answerInlineQuery([
    {
      type: "article",
      id: "random-record",
      title: title,
      input_message_content: { message_text: message },
      description: date,
    },
  ]);
});

bot.start();
