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

// Logging function
function logBotAction(
  action: string,
  userId?: number,
  username?: string,
  chatId?: number,
  data?: any
) {
  const timestamp = new Date().toISOString();
  const userInfo = userId
    ? `User: ${username || "Unknown"} (ID: ${userId})`
    : "Unknown user";
  const chatInfo = chatId ? `Chat: ${chatId}` : "";
  const dataInfo = data ? `Data: ${JSON.stringify(data)}` : "";

  console.log(
    `[${timestamp}] ${action} - ${userInfo} ${chatInfo} ${dataInfo}`.trim()
  );
}

bot.command("start", (ctx) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username;
  const chatId = ctx.chat?.id;

  logBotAction("START_COMMAND", userId, username, chatId);
  ctx.reply("Welcome to the Extrimism List Bot!");
});

bot.on("message:text", (ctx) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username;
  const chatId = ctx.chat?.id;
  const messageText = ctx.message.text;

  logBotAction("TEXT_MESSAGE", userId, username, chatId, { text: messageText });
  ctx.reply("You said: " + ctx.message.text);
});

// Inline mode: return a random record from the CSV
bot.on("inline_query", async (ctx) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username;
  const query = ctx.inlineQuery.query;

  logBotAction("INLINE_QUERY", userId, username, undefined, { query });

  // Respond immediately to prevent timeout
  try {
    if (!csvRecords || !Array.isArray(csvRecords) || csvRecords.length === 0) {
      logBotAction("INLINE_QUERY_NO_DATA", userId, username);
      await ctx.answerInlineQuery([
        {
          type: "article",
          id: "no-data",
          title: "No data available",
          input_message_content: { message_text: "No records found in CSV." },
        },
      ]);
      return;
    }

    // Show only one option with the specified text
    await ctx.answerInlineQuery([
      {
        type: "article",
        id: "extrimism-test",
        title: "Узнать какой ты экстримитский материал",
        input_message_content: {
          message_text:
            "Нажмите, чтобы узнать какой вы экстримитский материал!",
        },
        description: "Проверьте свою экстримитскую сущность",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Узнать", callback_data: "get_random_record" }],
          ],
        },
      },
    ]);

    logBotAction("INLINE_QUERY_ANSWERED", userId, username);
  } catch (error: unknown) {
    console.error("Inline query error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    logBotAction("INLINE_QUERY_ERROR", userId, username, undefined, {
      error: errorMessage,
    });
  }
});

// Handle callback query when user selects the option
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username;
  const chatId = ctx.chat?.id;
  const callbackData = ctx.callbackQuery.data;

  logBotAction("CALLBACK_QUERY", userId, username, chatId, {
    data: callbackData,
  });

  if (ctx.callbackQuery.data === "get_random_record") {
    if (!csvRecords || !Array.isArray(csvRecords) || csvRecords.length === 0) {
      logBotAction("CALLBACK_QUERY_NO_DATA", userId, username);
      await ctx.answerCallbackQuery("Данные недоступны");
      return;
    }

    // Generate a new random record
    const randomIndex = Math.floor(Math.random() * csvRecords.length);
    const random = csvRecords[randomIndex];

    // Format the record for display
    const title = random["Материал"] || Object.values(random)[0] || "Record";
    const date = random["Дата включения"] || Object.values(random)[1] || "";
    const message = `🎯 **Ваш экстримитский материал:**\n\n${title}\n\n📅 **Дата включения:** ${date}`;

    await ctx.editMessageText(message, { parse_mode: "Markdown" });
    await ctx.answerCallbackQuery();

    logBotAction("RANDOM_RECORD_SENT", userId, username, chatId, {
      recordIndex: randomIndex,
      title: title.substring(0, 50) + "...",
    });
  }
});

// Add error handling
bot.catch((err) => {
  console.error("Bot error:", err);
});

// Check if running on Deno Deploy
const isDenoDeploy = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;

if (isDenoDeploy) {
  // Webhook mode for Deno Deploy
  console.log("Starting bot in webhook mode on Deno Deploy");

  // Initialize the bot first
  await bot.init();

  // Handle webhook updates
  Deno.serve(async (req) => {
    if (req.method === "POST") {
      try {
        const update = await req.json();
        await bot.handleUpdate(update);
        return new Response("ok");
      } catch (err) {
        console.error("Webhook error:", err);
        return new Response("error", { status: 500 });
      }
    }
    return new Response("not found", { status: 404 });
  });
} else {
  // Polling mode for local development
  console.log("Starting bot in polling mode locally");
  bot.start();
}
