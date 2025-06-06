const db = require("../config/db");
const openai = require("../config/openai");
const deepseek = require("../config/deepseek");
const { query } = require("../config/db"); // make sure you're importing correctly
// const tiktoken = require("tiktoken"); // Make sure tiktoken is installed
const { encoding_for_model } = require("@dqbd/tiktoken");

// ✅ Create a new conversation

// exports.createConversation = async (req, res) => {
//   const user_id = req.user?.user_id;
//   if (!user_id) {
//     return res.status(400).json({ error: "User ID is required" });
//   }

//   try {
//     const name = req.body.name || "New Conversation";
//     console.log("📥 Incoming request body:", req.body);

//     // 🔍 Execute database query
//     const result = await db.query(
//       "INSERT INTO conversations (user_id, name) VALUES (?, ?)",
//       [user_id, name]
//     );

//     console.log("🔍 DB Query Result:", result);

//     // ✅ Ensure result has insertId
//     if (!result || !result.insertId) {
//       console.error("❌ Unexpected DB response format:", result);
//       return res
//         .status(500)
//         .json({ error: "Database query returned invalid response" });
//     }

//     const conversation_id = result.insertId; // ✅ Directly accessing insertId
//     console.log("✅ New conversation created with ID:", conversation_id);

//     return res.status(201).json({
//       success: true,
//       conversation_id,
//       name,
//     });
//   } catch (error) {
//     console.error("❌ Error creating conversation:", error.message);
//     res
//       .status(500)
//       .json({ error: "Failed to create conversation", details: error.message });
//   }
// };

// exports.createConversation = async (req, res) => {
//   const user_id = req.user?.user_id;
//   if (!user_id) {
//     return res.status(400).json({ error: "User ID is required" });
//   }

//   try {
//     const defaultName = "New Conversation";
//     console.log("📥 Incoming request body:", req.body);

//     // Step 1: Check if an empty (blank) conversation already exists
//     const [emptyConversations] = await db.query(
//       `SELECT c.id, c.name
//        FROM conversations c
//        LEFT JOIN chat_history ch ON c.id = ch.conversation_id
//        WHERE c.user_id = ?
//        GROUP BY c.id
//        HAVING COUNT(ch.id) = 0
//        ORDER BY c.created_at DESC
//        LIMIT 1`,
//       [user_id]
//     );

//     // Handle case when no blank conversations exist
//     if (!emptyConversations || emptyConversations.length === 0) {
//       // Step 2: Create a new conversation if no empty ones exist
//       const name = req.body.name || defaultName;
//       const [newConversation] = await db.query(
//         "INSERT INTO conversations (user_id, name) VALUES (?, ?)",
//         [user_id, name]
//       );

//       const conversation_id = newConversation.insertId;
//       console.log("✅ Created new conversation:", conversation_id);

//       return res.status(201).json({
//         success: true,
//         conversation_id,
//         name,
//       });
//     } else {
//       // Step 3: Reuse existing blank conversation
//       const conversation_id = emptyConversations[0].id;
//       const name = emptyConversations[0].name;
//       console.log("🔄 Reused empty conversation:", conversation_id);

//       return res.status(200).json({
//         success: true,
//         conversation_id,
//         name,
//       });
//     }

//   } catch (error) {
//     console.error("❌ Error creating conversation:", error.message);
//     return res.status(500).json({
//       error: "Failed to create or reuse conversation",
//       details: error.message,
//     });
//   }
// };

exports.createConversation = async (req, res) => {
  const user_id = req.user?.user_id;
  if (!user_id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    const defaultName = "New Conversation";
    console.log("📥 Incoming request body:", req.body);

    // Step 1: Find the most recent conversation for this user
    const recentConversationResult = await db.query(
      `SELECT id, name FROM conversations 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [user_id]
    );

    let recentConversation;
    if (Array.isArray(recentConversationResult)) {
      recentConversation = recentConversationResult[0];
    } else if (recentConversationResult && Array.isArray(recentConversationResult[0])) {
      recentConversation = recentConversationResult[0][0];
    }

    if (recentConversation) {
      // Step 2: Check if this conversation has any messages
      const messageCountResult = await db.query(
        `SELECT COUNT(*) as count FROM chat_history WHERE conversation_id = ?`,
        [recentConversation.id]
      );

      let messageCount;
      if (Array.isArray(messageCountResult)) {
        messageCount = messageCountResult[0]?.count || 0;
      } else if (messageCountResult && Array.isArray(messageCountResult[0])) {
        messageCount = messageCountResult[0][0]?.count || 0;
      }

      // If no messages, reuse this conversation
      if (messageCount === 0) {
        console.log("🔄 Reused empty conversation:", recentConversation.id);
        return res.status(200).json({
          success: true,
          conversation_id: recentConversation.id,
          name: recentConversation.name,
          action: "reused"
        });
      }
    }

    // Step 3: Create new conversation if none exists or recent one has messages
    const name = req.body.name || defaultName;
    const newConversationResult = await db.query(
      "INSERT INTO conversations (user_id, name) VALUES (?, ?)",
      [user_id, name]
    );

    let conversation_id;
    if (Array.isArray(newConversationResult)) {
      conversation_id = newConversationResult[0].insertId;
    } else if (newConversationResult && newConversationResult.insertId) {
      conversation_id = newConversationResult.insertId;
    } else {
      throw new Error("Failed to get insert ID");
    }

    console.log("✅ Created new conversation:", conversation_id);

    return res.status(201).json({
      success: true,
      conversation_id,
      name,
      action: "created"
    });

  } catch (error) {
    console.error("❌ Error creating conversation:", error);
    console.error("❌ Error stack:", error.stack);
    return res.status(500).json({
      error: "Failed to create or reuse conversation",
      details: error.message,
    });
  }
};







// ✅ Get all conversations for a user

exports.getConversations = async (req, res) => {
  const user_id = req.user.user_id;
  console.log("🔹 User ID in getConversations:", user_id);

  try {
    const rows = await db.query(
      "SELECT * FROM conversations WHERE user_id = ? AND is_deleted = FALSE ORDER BY created_at DESC",
      [user_id]
    );

    // console.log("🔍 Raw SQL result:", rows);

    // ✅ Ensure it's an array
    const conversations = Array.isArray(rows[0]) ? rows[0] : rows;

    // console.log("✅ Conversations (final processed):", conversations);
    res.json({ success: true, conversations });
  } catch (error) {
    console.error("❌ Error fetching conversations:", error.message);
    res.status(500).json({ error: "Failed to retrieve conversations" });
  }
};

// ✅ Get chat history for a specific conversation

// working

exports.getConversationHistory = async (req, res) => {
  const { conversation_id } = req.params;

  if (!conversation_id || isNaN(conversation_id)) {
    return res.status(400).json({ error: "Valid conversation ID is required" });
  }

  try {
    const sql = `
      SELECT id, user_message AS message, response, created_at, file_names, file_path
      FROM chat_history
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `;

    const rows = await query(sql, [parseInt(conversation_id)]);
    console.log("✅ Rows from DB:", rows);

    if (!rows.length) {
      return res.status(200).json({ success: false, history: [] });
    }

    // Reformat messages to include 'files' array
    const formattedHistory = rows.map((msg) => {
      const filePaths = msg.file_path ? msg.file_path.split(",") : [];
      const fileNames = msg.file_names ? msg.file_names.split(",") : [];

      const files = filePaths.map((path, index) => ({
        file_path: path,
        file_name: fileNames[index] || `file-${index + 1}`,
        type: path.split(".").pop() || "file",
      }));

      return {
        id: msg.id,
        sender: "user", // You can adjust this logic if needed
        message: msg.message,
        response: msg.response,
        files: files.length > 0 ? files : undefined,
        created_at: msg.created_at,
      };
    });

    return res.status(200).json({ success: true, history: formattedHistory });
  } catch (error) {
    console.error("❌ Error fetching conversation history:", error.message);
    return res
      .status(500)
      .json({ error: "Failed to retrieve conversation history" });
  }
};

// ✅ update conversation name
exports.updateConversationName = async (req, res) => {
  const { conversationId } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "New name is required" });
  }

  try {
    await db.query("UPDATE conversations SET name = ? WHERE id = ?", [
      name,
      conversationId,
    ]);
    return res.status(200).json({ success: true, name });
  } catch (error) {
    console.error("Error renaming conversation:", error.message);
    return res.status(500).json({ error: "Failed to rename conversation" });
  }
};

// ✅ Get general chat history for a user
exports.getChatHistory = async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const [history] = await db.query(
      "SELECT id, user_message AS message, response, created_at FROM chat_history WHERE user_id = ? ORDER BY created_at DESC",
      [user_id]
    );

    res.json({
      success: true,
      history: history.length > 0 ? history : [],
      message: history.length === 0 ? "No chat history found" : undefined,
    });
  } catch (error) {
    console.error("❌ Error fetching chat history:", error.message);
    res.status(500).json({ error: "Failed to retrieve chat history" });
  }
};

 

// test working 22-05-25
// exports.askChatbot = async (req, res) => {
//   console.log("✅ Received request at /chat:", req.body);

//   let { userMessage, conversation_id, extracted_summary } = req.body;
//   const user_id = req.user?.user_id;
//   const uploadedFiles = req.body.uploaded_file_metadata || [];

//   if (!user_id) {
//     return res.status(401).json({ error: "Unauthorized: User ID not found." });
//   }

//   if (!userMessage && !extracted_summary) {
//     return res
//       .status(400)
//       .json({ error: "User message or extracted summary is required" });
//   }

//   try {
//     if (!conversation_id || isNaN(conversation_id)) {
//       const [conversationResult] = await db.query(
//         "INSERT INTO conversations (user_id, name) VALUES (?, ?)",
//         [user_id, userMessage?.substring(0, 20) || "New Chat"]
//       );
//       conversation_id = conversationResult.insertId;
//     }

//     const [existingConversation] = await db.query(
//       "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
//       [conversation_id, user_id]
//     );

//     if (!existingConversation || existingConversation.length === 0) {
//       return res.status(403).json({
//         error: "Unauthorized: Conversation does not belong to the user.",
//       });
//     }

//     const historyResultsRaw = await db.query(
//       "SELECT user_message AS message, response, extracted_text, file_path FROM chat_history WHERE conversation_id = ? ORDER BY created_at ASC",
//       [conversation_id]
//     );

//     const historyResults = Array.isArray(historyResultsRaw)
//       ? historyResultsRaw
//       : [];

//     const chatHistory = [];
//     const allExtractedTexts = [];

//     historyResults.forEach((chat) => {
//       if (chat.message)
//         chatHistory.push({ role: "user", content: chat.message });
//       if (chat.response)
//         chatHistory.push({ role: "assistant", content: chat.response });
//       if (chat.extracted_text) allExtractedTexts.push(chat.extracted_text);
//     });

//     if (extracted_summary && extracted_summary !== "No readable content") {
//       allExtractedTexts.push(extracted_summary);
//     }

//     const currentDate = new Date().toLocaleDateString("en-US", {
//       year: "numeric",
//       month: "long",
//       day: "numeric",
//     });

//     const systemPrompt = {
//       role: "system",
//       content:
//         `You are an intelligent assistant. Today's date is ${currentDate}. ` +
//         "You are Quantumhash, an AI assistant developed by the Quantumhash development team in 2024. " +
//         "If someone asks for your name, *only say*: 'My name is Quantumhash AI.' " +
//         "If someone asks who developed you, *only say*: 'I was developed by the Quantumhash development team.' " +
//         `If someone asks about your knowledge cutoff, *only say*: 'I’ve got information up to the present, ${currentDate}.' ` +
//         "You have access to documents uploaded by the user. Use relevant content from them to answer user questions in detail.",
//     };

//     const finalMessages = [systemPrompt];

//     finalMessages.push(...chatHistory.slice(-10));

//     if (allExtractedTexts.length > 0) {
//       const structuredDocs = allExtractedTexts
//         .map((text, i) => `--- Document ${i + 1} ---\n${text}`)
//         .join("\n\n");

//       finalMessages.push({
//         role: "system",
//         content: `DOCUMENT CONTEXT:\n${structuredDocs.substring(0, 25000)}${
//           structuredDocs.length > 25000 ? "\n... (truncated)" : ""
//         }`,
//       });
//     }

//     let fullUserMessage = userMessage || "";
//     if (Array.isArray(uploadedFiles)) {
//       const fileNames = uploadedFiles.map((f) => f?.file_name).filter(Boolean);
//       if (fileNames.length > 0) {
//         fullUserMessage += `\n[Uploaded files: ${fileNames.join(", ")}]`;
//       }
//     }

//     finalMessages.push({ role: "user", content: fullUserMessage });

//     let aiResponse = "";
//     try {
//       const aiOptions = {
//         model: process.env.USE_OPENAI === "true" ? "gpt-4" : "deepseek-chat",
//         messages: finalMessages,
//         temperature: 0.7,
//         max_tokens: 7000,
//       };

//       const aiProvider = process.env.USE_OPENAI === "true" ? openai : deepseek;
//       const aiResult = await aiProvider.chat.completions.create(aiOptions);
//       aiResponse =
//         aiResult.choices?.[0]?.message?.content ||
//         "I couldn't generate a response. Please try again.";
//     } catch (aiError) {
//       console.error("AI API error:", aiError);
//       aiResponse =
//         "I'm having trouble processing your request. Please try again.";
//     }

//     try {
//       const filePaths = uploadedFiles
//         .map((f) => f?.file_path)
//         .filter(Boolean)
//         .join(",");
//       const fileNames = uploadedFiles
//         .map((f) => f?.file_name)
//         .filter(Boolean)
//         .join(",");

//       await db.query(
//         "INSERT INTO chat_history (conversation_id, user_message, response, created_at, file_path, extracted_text, file_names) VALUES (?, ?, ?, NOW(), ?, ?, ?)",
//         [
//           conversation_id,
//           userMessage,
//           aiResponse,
//           filePaths || null,
//           extracted_summary || null,
//           fileNames || null,
//         ]
//       );

//       if (userMessage) {
//         const [rows] = await db.query(
//           "SELECT name FROM conversations WHERE id = ?",
//           [conversation_id]
//         );
//         const currentName = rows?.name;
//         if (currentName === "New Conversation") {
//           const newName =
//             userMessage.length > 20
//               ? userMessage.substring(0, 17) + "..."
//               : userMessage;
//           await db.query("UPDATE conversations SET name = ? WHERE id = ?", [
//             newName,
//             conversation_id,
//           ]);
//         }
//       }
//     } catch (dbError) {
//       console.error("❌ Database save error:", dbError);
//     }

//     res.json({
//       success: true,
//       conversation_id,
//       response: aiResponse,
//       uploaded_files: uploadedFiles.map((file) => ({
//         file_name: file.file_name,
//         file_path: file.file_path,
//         file_type: file.file_name?.split(".").pop()?.toLowerCase() || null,
//       })),
//       context: {
//         document_available: allExtractedTexts.length > 0,
//       },
//     });
//   } catch (error) {
//     console.error("❌ Chat controller error:", error.stack || error.message);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

// test
exports.askChatbot = async (req, res) => {
  console.log("✅ Received request at /chat:", req.body);

  let { userMessage, conversation_id, extracted_summary } = req.body;
  const user_id = req.user?.user_id;
  const uploadedFiles = req.body.uploaded_file_metadata || [];

  if (!user_id) {
    return res.status(401).json({ error: "Unauthorized: User ID not found." });
  }

  if (!userMessage && !extracted_summary) {
    return res.status(400).json({
      error: "User message or extracted summary is required",
    });
  }

  try {
    // Create new conversation if needed
    if (!conversation_id || isNaN(conversation_id)) {
      const [conversationResult] = await db.query(
        "INSERT INTO conversations (user_id, name) VALUES (?, ?)",
        [user_id, userMessage?.substring(0, 20) || "New Chat"]
      );
      conversation_id = conversationResult.insertId;
    }

    // Validate conversation
    const [existingConversation] = await db.query(
      "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
      [conversation_id, user_id]
    );
    if (!existingConversation || existingConversation.length === 0) {
      return res.status(403).json({
        error: "Unauthorized: Conversation does not belong to the user.",
      });
    }

    // Fetch chat history
    const historyResultsRaw = await db.query(
      "SELECT user_message AS message, response, extracted_text, file_path FROM chat_history WHERE conversation_id = ? ORDER BY created_at ASC",
      [conversation_id]
    );

    const historyResults = Array.isArray(historyResultsRaw) ? historyResultsRaw : [];

    const chatHistory = [];
    const allExtractedTexts = [];

    historyResults.forEach((chat) => {
      if (chat.message) chatHistory.push({ role: "user", content: chat.message });
      if (chat.response) chatHistory.push({ role: "assistant", content: chat.response });
      if (chat.extracted_text) allExtractedTexts.push(chat.extracted_text);
    });

    if (extracted_summary && extracted_summary !== "No readable content") {
      allExtractedTexts.push(extracted_summary);
    }

    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const systemPrompt = {
      role: "system",
      content:
        `You are an intelligent assistant. Today's date is ${currentDate}. ` +
        "You are Quantumhash, an AI assistant developed by the Quantumhash development team in 2024. " +
        "If someone asks for your name, *only say*: 'My name is Quantumhash AI.' " +
        "If someone asks who developed you, *only say*: 'I was developed by the Quantumhash development team.' " +
        `If someone asks about your knowledge cutoff, *only say*: 'I’ve got information up to the present, ${currentDate}.' ` +
        "You have access to documents uploaded by the user. Use relevant content from them to answer user questions in detail.",
    };

    const finalMessages = [systemPrompt, ...chatHistory.slice(-10)];

    if (allExtractedTexts.length > 0) {
      const structuredDocs = allExtractedTexts
        .map((text, i) => `--- Document ${i + 1} ---\n${text}`)
        .join("\n\n");
      finalMessages.push({
        role: "system",
        content: `DOCUMENT CONTEXT:\n${structuredDocs.substring(0, 25000)}${
          structuredDocs.length > 25000 ? "\n... (truncated)" : ""
        }`,
      });
    }

    let fullUserMessage = userMessage || "";
    if (Array.isArray(uploadedFiles)) {
      const fileNames = uploadedFiles.map((f) => f?.file_name).filter(Boolean);
      if (fileNames.length > 0) {
        fullUserMessage += `\n[Uploaded files: ${fileNames.join(", ")}]`;
      }
    }

    finalMessages.push({ role: "user", content: fullUserMessage });

    let aiResponse = "";
    let suggestions = [];

    try {
      const aiOptions = {
        model: process.env.USE_OPENAI === "true" ? "gpt-4" : "deepseek-chat",
        messages: finalMessages,
        temperature: 0.7,
        max_tokens: 7000,
      };

      const aiProvider = process.env.USE_OPENAI === "true" ? openai : deepseek;
      const aiResult = await aiProvider.chat.completions.create(aiOptions);

      aiResponse =
        aiResult.choices?.[0]?.message?.content ||
        "I couldn't generate a response. Please try again.";

      // ✅ Build better suggestion prompt
      const suggestionPrompt = [
        {
          role: "system",
          content:
            "You are a thoughtful and helpful assistant. Based on the user's last message and your reply, generate 5 engaging follow-up questions. Keep them relevant, short, and user-friendly. Reply ONLY with the 3 questions in a numbered list. No intro or outro.",
        },
        { role: "user", content: userMessage },
        { role: "assistant", content: aiResponse },
      ];

      const suggestionResult = await aiProvider.chat.completions.create({
        model: process.env.USE_OPENAI === "true" ? "gpt-4" : "deepseek-chat",
        messages: suggestionPrompt,
        temperature: 0.7,
        max_tokens: 300,
      });

      const rawSuggestion = suggestionResult.choices?.[0]?.message?.content || "";
      suggestions = rawSuggestion
        .split("\n")
        .map((s) => s.replace(/^[\d\-•\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 5); // Ensure max 3

     
    } catch (aiError) {
      console.error("❌ AI suggestion generation failed:", aiError);
      suggestions = [];
    }

    try {
      const filePaths = uploadedFiles.map((f) => f?.file_path).filter(Boolean).join(",");
      const fileNames = uploadedFiles.map((f) => f?.file_name).filter(Boolean).join(",");

      await db.query(
        "INSERT INTO chat_history (conversation_id, user_message, response, created_at, file_path, extracted_text, file_names) VALUES (?, ?, ?, NOW(), ?, ?, ?)",
        [
          conversation_id,
          userMessage,
          aiResponse,
          filePaths || null,
          extracted_summary || null,
          fileNames || null,
        ]
      );

      if (userMessage) {
        const [rows] = await db.query(
          "SELECT name FROM conversations WHERE id = ?",
          [conversation_id]
        );
        const currentName = rows?.name;
        if (currentName === "New Conversation") {
          const newName =
            userMessage.length > 20
              ? userMessage.substring(0, 17) + "..."
              : userMessage;
          await db.query("UPDATE conversations SET name = ? WHERE id = ?", [
            newName,
            conversation_id,
          ]);
        }
      }
    } catch (dbError) {
      console.error("❌ Database save error:", dbError);
    }

    res.json({
      success: true,
      conversation_id,
      response: aiResponse,
      suggestions,
      uploaded_files: uploadedFiles.map((file) => ({
        file_name: file.file_name,
        file_path: file.file_path,
        file_type: file.file_name?.split(".").pop()?.toLowerCase() || null,
      })),
      context: {
        document_available: allExtractedTexts.length > 0,
      },
    });
  } catch (error) {
    console.error("❌ Chat controller error:", error.stack || error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};


// guestchat 



// exports.guestChat = async (req, res) => {
//   const { userMessage } = req.body;

//   if (!userMessage || typeof userMessage !== "string") {
//     return res.status(400).json({ error: "Message is required." });
//   }

//   try {
//     const currentDate = new Date().toLocaleDateString("en-US", {
//       year: "numeric",
//       month: "long",
//       day: "numeric",
//     });

//     const systemPrompt = {
//       role: "system",
//       content:
//         `You are an intelligent assistant. Today's date is ${currentDate}. ` +
//         "You are Quantumhash, an AI assistant developed by the Quantumhash development team in 2024. " +
//         "If someone asks for your name, *only say*: 'My name is Quantumhash AI.' " +
//         "If someone asks who developed you, *only say*: 'I was developed by the Quantumhash development team.' " +
//         `If someone asks about your knowledge cutoff, *only say*: 'I’ve got information up to the present, ${currentDate}.'`,
//     };

//     const messages = [
//       systemPrompt,
//       { role: "user", content: userMessage }
//     ];

//     const aiProvider = process.env.USE_OPENAI === "true" ? openai : deepseek;

//     const aiResult = await aiProvider.chat.completions.create({
//       model: process.env.USE_OPENAI === "true" ? "gpt-4" : "deepseek-chat",
//       messages,
//       temperature: 0.7,
//       max_tokens: 1500,
//     });

//     const aiResponse =
//       aiResult.choices?.[0]?.message?.content || "I couldn't generate a response.";

//     // 🔁 Suggested questions generation
//     let suggestions = [];
//     try {
//       const suggestionPrompt = [
//         {
//           role: "system",
//           content:
//             "You are a thoughtful and helpful assistant. Based on the user's last message and your reply, generate 3 engaging follow-up questions. Keep them relevant and user-friendly. Reply ONLY with the 3 questions in a numbered list.",
//         },
//         { role: "user", content: userMessage },
//         { role: "assistant", content: aiResponse },
//       ];

//       const suggestionResult = await aiProvider.chat.completions.create({
//         model: process.env.USE_OPENAI === "true" ? "gpt-4" : "deepseek-chat",
//         messages: suggestionPrompt,
//         temperature: 0.7,
//         max_tokens: 300,
//       });

//       const rawSuggestion = suggestionResult.choices?.[0]?.message?.content || "";
//       suggestions = rawSuggestion
//         .split("\n")
//         .map((s) => s.replace(/^[\d\-•\s]+/, "").trim())
//         .filter(Boolean)
//         .slice(0, 3);
//     } catch (suggestionError) {
//       console.error("⚠️ Suggestion generation failed:", suggestionError.message);
//     }

//     return res.json({
//       success: true,
//       response: aiResponse,
//       suggestions,
//     });
//   } catch (error) {
//     console.error("❌ Guest chat error:", error.stack || error.message);
//     res.status(500).json({ error: "Internal server error." });
//   }
// };

exports.guestChat = async (req, res) => {
 const { userMessage } = req.body;
if (!userMessage || typeof userMessage !== "string") {
  return res.status(400).json({ error: "Message is required." });
}


  try {
    // 📅 Get current date in "Month Day, Year" format
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // 🧠 System prompt defining assistant identity and behavior
    const systemPrompt = {
      role: "system",
      content: 
        `You are an intelligent assistant. Today's date is ${currentDate}. ` +
        "You are Quantumhash, an AI assistant developed by the Quantumhash development team in 2024. " +
        "If someone asks for your name, *only say*: 'My name is Quantumhash AI.' " +
        "If someone asks who developed you, *only say*: 'I was developed by the Quantumhash development team.' " +
        `If someone asks about your knowledge cutoff, *only say*: 'I’ve got information up to the present, ${currentDate}.'`,
    };

    const messages = [
      systemPrompt,
      { role: "user", content: userMessage },
    ];

    // 🔀 Choose AI provider based on environment config
    const aiProvider = process.env.USE_OPENAI === "true" ? openai : deepseek;
    const model = process.env.USE_OPENAI === "true" ? "gpt-4" : "deepseek-chat";

    // 💬 Get AI response
    const aiResult = await aiProvider.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const aiResponse = aiResult.choices?.[0]?.message?.content || "I couldn't generate a response.";

    // 🤖 Generate suggested follow-up questions
    let suggestions = [];
    try {
      const suggestionPrompt = [
        {
          role: "system",
          content:
            "You are a thoughtful and helpful assistant. Based on the user's last message and your reply, generate 3 engaging follow-up questions. Keep them relevant and user-friendly. Reply ONLY with the 3 questions in a numbered list.",
        },
        { role: "user", content: userMessage },
        { role: "assistant", content: aiResponse },
      ];

      const suggestionResult = await aiProvider.chat.completions.create({
        model,
        messages: suggestionPrompt,
        temperature: 0.7,
        max_tokens: 300,
      });

      const rawSuggestion = suggestionResult.choices?.[0]?.message?.content || "";

      // 🧹 Parse suggestions from numbered list
      suggestions = rawSuggestion
        .split("\n")
        .map((s) => s.replace(/^[\d\-\•\s]+/, "").trim()) // Remove numbering/bullets
        .filter(Boolean)
        .slice(0, 3); // Limit to top 3
    } catch (suggestionError) {
      console.error("⚠️ Failed to generate suggestions:", suggestionError.message);
    }

    // ✅ Send successful response
    return res.json({
      success: true,
      response: aiResponse,
      suggestions,
    });
  } catch (error) {
    // ❌ Catch unexpected errors
    console.error("❌ Guest chat error:", error.stack || error.message);
    return res.status(500).json({ error: "Internal server error." });
  }
};





//  delete function

exports.softDeleteConversation = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_id;

  try {
    const result = await db.query(
      "UPDATE conversations SET is_deleted = TRUE WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "Conversation not found or unauthorized" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error soft deleting conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
