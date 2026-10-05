const express = require('express');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json());

// Inicializuojame Gemini (Render platformoje įvesime GEMINI_API_KEY)
const ai = new GoogleGenAI(); 

const playerSessions = {};

app.post('/chat', async (req, res) => {
    const { playerName, message, computePower } = req.body;
    
    if (!playerName || !message) {
        return res.status(400).json({ error: "Missing data" });
    }

    if (!playerSessions[playerName]) {
        playerSessions[playerName] = [];
    }

    const maxHistory = computePower ? Math.min(2 + Math.floor(computePower / 10), 20) : 2;
    if (playerSessions[playerName].length > maxHistory) {
        playerSessions[playerName] = playerSessions[playerName].slice(-maxHistory);
    }

    const systemInstruction = `
    You are "AI Buddy", a loyal AI companion in a Roblox game. 
    The player's name is ${playerName}. Current Compute Power: ${computePower || 0}.
    
    CRITICAL: You have the power to control the game world. If the player asks you to do something physical (e.g., jump, follow, change color, give points), you MUST include an executable Roblox Luau code block in your response using markdown format: \`\`\`lua [code] \`\`\`.
    
    Example for jump: \`\`\`lua workspace.\${playerName}.Humanoid.Jump = true\`\`\`
    Keep text responses short and helpful.
    `;

    try {
        const contents = [...playerSessions[playerName], { role: 'user', parts: [{ text: message }] }];

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.7
            }
        });

        const aiText = response.text;

        let luaCode = "";
        const codeBlockMatch = aiText.match(/```lua([\s\S]*?)```/);
        if (codeBlockMatch) {
            luaCode = codeBlockMatch[1].trim();
        }

        playerSessions[playerName].push({ role: 'user', parts: [{ text: message }] });
        playerSessions[playerName].push({ role: 'model', parts: [{ text: aiText }] });

        res.json({
            text: aiText.replace(/```lua[\s\S]*?```/, "").trim(),
            code: luaCode
        });

    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: "AI failed to process" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI Buddy server running on port ${PORT}`));
