import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { Bot, Context } from "https://deno.land/x/grammy@v1.37.0/mod.ts";
import { parse } from "https://deno.land/std@0.224.0/csv/mod.ts";

// Parse CSV from root
async function parseLocalCSV(path: string) {
  try {
    const csvText = await Deno.readTextFile(path);
    // const csvText = `Материал;Дата включения
    // Музыкальный альбом 'Музыка белых', автор - Музыкальная группа Order, решение вынесено Первомайским районным судом г. Омска от 23.11.2006;23.11.2006`;
    const records = await parse(csvText, {
      skipFirstRow: true,
      separator: ";",
    });
    console.log(
      `Local CSV '${path}' loaded, records count:`,
      Array.isArray(records) ? records.length : Object.keys(records).length
    );
    return records;
  } catch (e: any) {
    console.error(`Failed to load local CSV '${path}':`, e.message);
    return null;
  }
}

const csvRecords = await parseLocalCSV("list.csv");

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
