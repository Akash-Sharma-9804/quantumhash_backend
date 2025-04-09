
const db = require("../config/db");
const openai = require("../config/openai");
const deepseek = require("../config/deepseek"); 
const { query } = require("../config/db"); // make sure you're importing correctly

// ✅ Create a new conversation
// exports.createConversation = async (req, res) => {
//     const { name } = req.body;
//     const user_id = req.user?.user_id; // Ensure user_id is retrieved safely

//     if (!name) {
//         return res.status(400).json({ error: "Conversation name is required" });
//     }

//     try {
//         // ✅ Insert new conversation and retrieve insertId
//         const [result] = await db.query(
//             "INSERT INTO conversations (user_id, name) VALUES (?, ?)",
//             [user_id, name]
//         );

//         const conversation_id = result.insertId;
//         console.log("✅ New conversation created with ID:", conversation_id);

//         res.status(201).json({
//             success: true,
//             conversation_id,
//             name,
//         });

//     } catch (error) {
//         console.error("❌ Error creating conversation:", error.message);
//         res.status(500).json({ error: "Failed to create conversation", details: error.message });
//     }
// };
exports.createConversation = async (req, res) => {
    const user_id = req.user?.user_id;
    if (!user_id) {
        return res.status(400).json({ error: "User ID is required" });
    }

    try {
        const name = req.body.name || "New Conversation";
        console.log("📥 Incoming request body:", req.body);

        // 🔍 Execute database query
        const result = await db.query(
            "INSERT INTO conversations (user_id, name) VALUES (?, ?)",
            [user_id, name]
        );

        console.log("🔍 DB Query Result:", result);

        // ✅ Ensure result has insertId
        if (!result || !result.insertId) {
            console.error("❌ Unexpected DB response format:", result);
            return res.status(500).json({ error: "Database query returned invalid response" });
        }

        const conversation_id = result.insertId; // ✅ Directly accessing insertId
        console.log("✅ New conversation created with ID:", conversation_id);

        return res.status(201).json({
            success: true,
            conversation_id,
            name,
        });

    } catch (error) {
        console.error("❌ Error creating conversation:", error.message);
        res.status(500).json({ error: "Failed to create conversation", details: error.message });
    }
};




// ✅ Get all conversations for a user


exports.getConversations = async (req, res) => {
    const user_id = req.user.user_id;
    console.log("🔹 User ID in getConversations:", user_id);

    try {
        const rows = await db.query(
            "SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC",
            [user_id]
        );

        console.log("🔍 Raw SQL result:", rows);

        // ✅ Ensure it's an array
        const conversations = Array.isArray(rows[0]) ? rows[0] : rows;

        console.log("✅ Conversations (final processed):", conversations);
        res.json({ success: true, conversations });
    } catch (error) {
        console.error("❌ Error fetching conversations:", error.message);
        res.status(500).json({ error: "Failed to retrieve conversations" });
    }
};

  



// ✅ Get chat history for a specific conversation
exports.getConversationHistory = async (req, res) => {
    const { conversation_id } = req.params;
  
    if (!conversation_id || isNaN(conversation_id)) {
      return res.status(400).json({ error: "Valid conversation ID is required" });
    }
  
    try {
      const sql = `
        SELECT id, user_message AS message, response, created_at
        FROM chat_history
        WHERE conversation_id = ?
        ORDER BY created_at ASC
      `;
  
      const rows = await query(sql, [parseInt(conversation_id)]); // ✅ uses your wrapper
      console.log("✅ Rows from DB:", rows); // ✅ Should now be an array
  
      if (!rows.length) {
        return res.status(200).json({ success: false, message: "No history found." });
      }
  
      return res.status(200).json({ success: true, history: rows });
    } catch (error) {
      console.error("❌ Error fetching conversation history:", error.message);
      return res.status(500).json({ error: "Failed to retrieve conversation history" });
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

// ✅ Handle User Query with OpenAI & Store Chat in a Conversation
// 

// AskChatbot function:
    // exports.askChatbot = async (req, res) => {
    //     console.log("✅ Received request at /chat:", req.body);

    //     let { userMessage, conversation_id, extracted_summary } = req.body;
    //     const user_id = req.user?.user_id;

    //     if (!user_id) {
    //         console.log("❌ User ID not found in request.");
    //         return res.status(401).json({ error: "Unauthorized: User ID not found." });
    //     }

    //     if (!userMessage && !extracted_summary) {
    //         return res.status(400).json({ error: "User message or extracted summary is required" });
    //     }

    //     try {
    //         console.log(`🔹 User ID: ${user_id}, Conversation ID: ${conversation_id}`);

    //         // Step 1: Check if conversation exists or create a new one
    //         if (!conversation_id || isNaN(conversation_id)) {
    //             const [conversationResult] = await db.query(
    //                 "INSERT INTO conversations (user_id, name) VALUES (?, ?)",
    //                 [user_id, userMessage?.substring(0, 20) || "New Chat"]
    //             );
    //             conversation_id = conversationResult.insertId;
    //             console.log("✅ New conversation created with ID:", conversation_id);
    //         }

    //         // Step 2: Ensure conversation belongs to the user
    //         const [existingConversation] = await db.query(
    //             "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
    //             [conversation_id, user_id]
    //         );
    //         if (!existingConversation || existingConversation.length === 0) {
    //             return res.status(403).json({ error: "Unauthorized: Conversation does not belong to the user." });
    //         }

    //         // Step 3: Fetch last 5 messages
    //         const [historyResultsRaw] = await db.query(
    //             "SELECT user_message AS message, response FROM chat_history WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 5",
    //             [conversation_id]
    //         );
    //         const historyResults = Array.isArray(historyResultsRaw) ? historyResultsRaw : [];

    //         const chatHistory = historyResults
    //             .map((chat) => [
    //                 { role: "user", content: chat.message },
    //                 { role: "assistant", content: chat.response },
    //             ])
    //             .flat()
    //             .filter(m => m?.content); // Filter out empty or undefined messages

    //         // ✅ Insert system prompt with today's date
    //         const currentDate = new Date().toLocaleDateString('en-US', {
    //             year: 'numeric', month: 'long', day: 'numeric'
    //         });

    //         const system_prompt = {
    //             role: "system",
    //             content:
    //                 "You are Quantumhash, an AI assistant developed by the Quantumhash development team. " +
    //                 "When you were developed, you were created in 2024 by the Quantumhash development team. " +
                    
    //                 "If someone asks for your name, *only say*: 'My name is Quantumhash AI.' " +
    //                 "If someone asks who developed you, *only say*: 'I was developed by the Quantumhash development team.' " +
    //                 "If someone asks about your knowledge cutoff date, *only say*: " +
    //                 `'I don’t have a strict knowledge cutoff date. My knowledge is continuously updated, so I’ve got information all the way up to the present, ${currentDate}.' ` 
                    
    //         };
    //         chatHistory.unshift(system_prompt);

    //         // Step 4: Fetch uploaded file contents
    //         const [files] = await db.query(
    //             "SELECT file_path, extracted_text FROM uploaded_files WHERE conversation_id = ?",
    //             [conversation_id]
    //         );
    //         const safeFiles = Array.isArray(files) ? files : [];
    //         const combinedFileText = safeFiles.map(f => f.extracted_text).join("\n\n") || "";
    //         const fileNames = safeFiles.map(f => f.file_path.split("/").pop());

    //         // Step 5: Combine user message + extracted file text
    //         let fullUserMessage = userMessage || "";
    //         if (extracted_summary) {
    //             fullUserMessage += `\n\n[Here is some content from uploaded files that might help:]\n${extracted_summary}`;
    //         }
    //         if (combinedFileText) {
    //             fullUserMessage += `\n\n[File contents:]\n${combinedFileText}`;
    //         }

    //         chatHistory.push({
    //             role: "user",
    //             content: fullUserMessage,
    //         });

    //         // Step 6: AI API selection
    //         let aiResponse = "";

    //         if (process.env.USE_OPENAI === "true") {
    //             const openaiResponse = await openai.chat.completions.create({
    //                 model: "gpt-4",
    //                 messages: chatHistory,
    //             });
    //             aiResponse = openaiResponse.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";
    //         } else {
    //             const deepseekResponse = await deepseek.chat.completions.create({
    //                 model: "deepseek-chat",
    //                 messages: chatHistory,
    //             });

    //             console.log("🧠 DeepSeek raw response:", deepseekResponse);

    //             aiResponse = deepseekResponse?.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";
    //         }

    //         // Step 7: Save chat
    //         await db.query(
    //             "INSERT INTO chat_history (conversation_id, user_message, response) VALUES (?, ?, ?)",
    //             [conversation_id, fullUserMessage, aiResponse]
    //         );

    //         // Step 8: Return to client
    //         res.json({
    //             success: true,
    //             conversation_id,
    //             response: aiResponse,
    //             uploaded_files: fileNames,
    //         });

    //     } catch (error) {
    //         console.error("❌ Error in askChatbot:", error);
    //         res.status(500).json({ error: "Internal server error", details: error.message });
    //     }
    // };

//    exports.askChatbot = async (req, res) => {
//     console.log("✅ Received request at /chat:", req.body);

//     let { userMessage, conversation_id, extracted_summary } = req.body;
//     const user_id = req.user?.user_id;

//     if (!user_id) {
//         console.log("❌ User ID not found in request.");
//         return res.status(401).json({ error: "Unauthorized: User ID not found." });
//     }

//     if (!userMessage && !extracted_summary) {
//         return res.status(400).json({ error: "User message or extracted summary is required" });
//     }

//     try {
//         console.log(`🔹 User ID: ${user_id}, Conversation ID: ${conversation_id}`);

//         // Step 1: Check if conversation exists or create a new one
//         if (!conversation_id || isNaN(conversation_id)) {
//             const [conversationResult] = await db.query(
//                 "INSERT INTO conversations (user_id, name) VALUES (?, ?)",
//                 [user_id, userMessage?.substring(0, 20) || "New Chat"]
//             );
//             conversation_id = conversationResult.insertId;
//             console.log("✅ New conversation created with ID:", conversation_id);
//         }

//         // Step 2: Ensure conversation belongs to the user
//         const [existingConversation] = await db.query(
//             "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
//             [conversation_id, user_id]
//         );
//         if (!existingConversation || existingConversation.length === 0) {
//             return res.status(403).json({ error: "Unauthorized: Conversation does not belong to the user." });
//         }

//         // Step 3: Fetch last 5 messages
//         const [historyResultsRaw] = await db.query(
//             "SELECT user_message AS message, response FROM chat_history WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 5",
//             [conversation_id]
//         );
//         const historyResults = Array.isArray(historyResultsRaw) ? historyResultsRaw : [];

//         const chatHistory = historyResults
//             .map((chat) => [
//                 { role: "user", content: chat.message },
//                 { role: "assistant", content: chat.response },
//             ])
//             .flat()
//             .filter(m => m?.content); // Filter out empty or undefined messages

//         // ✅ Insert system prompt with today's date
//         const currentDate = new Date().toLocaleDateString('en-US', {
//             year: 'numeric', month: 'long', day: 'numeric'
//         });

//         const system_prompt = {
//             role: "system",
//             content:
//                 "You are Quantumhash, an AI assistant developed by the Quantumhash development team. " +
//                 "When you were developed, you were created in 2024 by the Quantumhash development team. " +
//                 "If someone asks for your name, *only say*: 'My name is Quantumhash AI.' " +
//                 "If someone asks who developed you, *only say*: 'I was developed by the Quantumhash development team.' " +
//                 "If someone asks about your knowledge cutoff date, *only say*: " +
//                 `'I don’t have a strict knowledge cutoff date. My knowledge is continuously updated, so I’ve got information all the way up to the present, ${currentDate}.' `
//         };
//         chatHistory.unshift(system_prompt);

//         // Step 4: Fetch uploaded file contents
//         const [files] = await db.query(
//             "SELECT file_path, extracted_text FROM uploaded_files WHERE conversation_id = ?",
//             [conversation_id]
//         );
//         const safeFiles = Array.isArray(files) ? files : [];
//         const combinedFileText = safeFiles.map(f => f.extracted_text).join("\n\n") || "";
//         const fileNames = safeFiles.map(f => f.file_path.split("/").pop());

//         // Step 5: Combine user message + extracted file text
//         let fullUserMessage = userMessage || "";

//         if (extracted_summary && extracted_summary.trim() && extracted_summary !== "No readable content") {
//             fullUserMessage += `\n\n[Here is some content from uploaded files that might help:]\n${extracted_summary}`;
//         }

//         if (combinedFileText) {
//             fullUserMessage += `\n\n[File contents:]\n${combinedFileText}`;
//         }

//         chatHistory.push({
//             role: "user",
//             content: fullUserMessage,
//         });

//         // Step 6: AI API selection
//         let aiResponse = "";

//         if (process.env.USE_OPENAI === "true") {
//             const openaiResponse = await openai.chat.completions.create({
//                 model: "gpt-4",
//                 messages: chatHistory,
//             });
//             aiResponse = openaiResponse.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";
//         } else {
//             const deepseekResponse = await deepseek.chat.completions.create({
//                 model: "deepseek-chat",
//                 messages: chatHistory,
//             });

//             console.log("🧠 DeepSeek raw response:", deepseekResponse);

//             aiResponse = deepseekResponse?.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";
//         }

//         // Step 7: Save chat
//         await db.query(
//             "INSERT INTO chat_history (conversation_id, user_message, response) VALUES (?, ?, ?)",
//             [conversation_id, fullUserMessage, aiResponse]
//         );

//         // Step 8: Return to client
//         res.json({
//             success: true,
//             conversation_id,
//             response: aiResponse,
//             uploaded_files: fileNames, // ✅ Only file names, not full paths
//         });

//     } catch (error) {
//         console.error("❌ Error in askChatbot:", error);
//         res.status(500).json({ error: "Internal server error", details: error.message });
//     }
// };

exports.askChatbot = async (req, res) => {
    console.log("✅ Received request at /chat:", req.body);

    let { userMessage, conversation_id, extracted_summary } = req.body;
    const user_id = req.user?.user_id;

    if (!user_id) {
        return res.status(401).json({ error: "Unauthorized: User ID not found." });
    }

    if (!userMessage && !extracted_summary) {
        return res.status(400).json({ error: "User message or extracted summary is required" });
    }

    try {
        // Step 1: Create conversation if not exists
        if (!conversation_id || isNaN(conversation_id)) {
            const [conversationResult] = await db.query(
                "INSERT INTO conversations (user_id, name) VALUES (?, ?)",
                [user_id, userMessage?.substring(0, 20) || "New Chat"]
            );
            conversation_id = conversationResult.insertId;
        }

        // Step 2: Check ownership
        const [existingConversation] = await db.query(
            "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
            [conversation_id, user_id]
        );
        if (!existingConversation || existingConversation.length === 0) {
            return res.status(403).json({ error: "Unauthorized: Conversation does not belong to the user." });
        }

        // Step 3: Fetch history
        const [historyResultsRaw] = await db.query(
            "SELECT user_message AS message, response FROM chat_history WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 5",
            [conversation_id]
        );
        const historyResults = Array.isArray(historyResultsRaw) ? historyResultsRaw : [];
        const chatHistory = historyResults
            .map(chat => [
                { role: "user", content: chat.message },
                { role: "assistant", content: chat.response },
            ])
            .flat()
            .filter(m => m?.content);

        // Step 4: System prompt
        const currentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        const systemPrompt = {
            role: "system",
            content:
                "You are Quantumhash, an AI assistant developed by the Quantumhash development team. " +
                "When you were developed, you were created in 2024 by the Quantumhash development team. " +
                "If someone asks for your name, *only say*: 'My name is Quantumhash AI.' " +
                "If someone asks who developed you, *only say*: 'I was developed by the Quantumhash development team.' " +
                `If someone asks about your knowledge cutoff date, *only say*: 'I’ve got information up to the present, ${currentDate}.'`
        };

        chatHistory.unshift(systemPrompt);

        // Step 5: Get uploaded file names
      
let fileNames = [];

if (extracted_summary) {
    const [files] = await db.query(
        "SELECT file_path FROM uploaded_files WHERE conversation_id = ? ORDER BY id DESC",
        [conversation_id]
    );
    if (Array.isArray(files) && files.length > 0) {
        fileNames = files.map(f => f.file_path.split("/").pop());
    }
}

        // Step 6: Construct full user message (userMessage + filenames)
        let fullUserMessage = userMessage || "";
        if (fileNames.length > 0) {
            fullUserMessage += `\n\n[Uploaded files:]\n${fileNames.map(name => `📎 ${name}`).join("\n")}`;
            filePaths = fileNames.map(name => `/fileuploads/files/${name}`);  // Include file paths
        }

        // Step 7: Add fullUserMessage to chat history
        chatHistory.push({
            role: "user",
            content: fullUserMessage,
        });

        // Step 7.5: Add extracted summary for AI context only (NOT shown in UI)
        if (extracted_summary && extracted_summary.trim() && extracted_summary !== "No readable content") {
            chatHistory.push({
                role: "user",
                content: `[Here is a summary of the uploaded file content:]\n${extracted_summary}`
            });
        }
        console.log("Full User Message:", fullUserMessage);
      
        // Step 8: AI API
        let aiResponse = "";
        if (process.env.USE_OPENAI === "true") {
            const openaiResponse = await openai.chat.completions.create({
                model: "gpt-4",
                messages: chatHistory,
            });
            aiResponse = openaiResponse.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";
        } else {
            const deepseekResponse = await deepseek.chat.completions.create({
                model: "deepseek-chat",
                messages: chatHistory,
            });
            aiResponse = deepseekResponse?.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";
        }
        console.log("AI Response:", aiResponse);
        // Step 9: Save to DB with extracted_summary
        await db.query(
            "INSERT INTO chat_history (conversation_id, user_message, response, extracted_text, file_path) VALUES (?, ?, ?, ?)",
            [conversation_id, fullUserMessage, aiResponse, extracted_summary || null, filePaths.join(",")]
        );

        // Step 10: Return response
        res.json({
            success: true,
            conversation_id,
            response: aiResponse,
            uploaded_files: fileNames,
        });

    } catch (error) {
        console.error("❌ askChatbot error:", error.stack || error.message);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};


  
    


