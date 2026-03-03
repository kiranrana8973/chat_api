"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = __importStar(require("mongoose"));
const bcrypt = __importStar(require("bcryptjs"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/chat_api";
const UserSchema = new mongoose.Schema({
    fname: String,
    lname: String,
    email: { type: String, unique: true, lowercase: true },
    password: String,
    authProvider: { type: String, default: "local" },
    oauthId: { type: String, default: null },
    gender: String,
    batch: String,
    isProfileComplete: { type: Boolean, default: true },
    avatar: { type: String, default: "" },
    fcmToken: { type: String, default: "" },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    role: { type: String, default: "user" },
}, { timestamps: true });
const ConversationSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
    },
}, { timestamps: true });
const MessageSchema = new mongoose.Schema({
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: { type: String, default: "text" },
    text: { type: String, default: "" },
    image: { type: String, default: "" },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });
const User = mongoose.model("User", UserSchema);
const Conversation = mongoose.model("Conversation", ConversationSchema);
const Message = mongoose.model("Message", MessageSchema);
const semesters = [
    "Sem 1",
    "Sem 2",
    "Sem 3",
    "Sem 4",
    "Sem 5",
    "Sem 6",
    "Sem 7",
    "Sem 8",
];
const seedUsers = [
    {
        fname: "Admin",
        lname: "User",
        email: "admin@chatapp.com",
        password: "admin123",
        gender: "male",
        batch: "Sem 1",
        role: "admin",
    },
    {
        fname: "Aarav",
        lname: "Sharma",
        email: "aarav@example.com",
        password: "password123",
        gender: "male",
        batch: "Sem 3",
        role: "user",
    },
    {
        fname: "Priya",
        lname: "Patel",
        email: "priya@example.com",
        password: "password123",
        gender: "female",
        batch: "Sem 3",
        role: "user",
    },
    {
        fname: "Rohan",
        lname: "Gupta",
        email: "rohan@example.com",
        password: "password123",
        gender: "male",
        batch: "Sem 5",
        role: "user",
    },
    {
        fname: "Ananya",
        lname: "Singh",
        email: "ananya@example.com",
        password: "password123",
        gender: "female",
        batch: "Sem 5",
        role: "user",
    },
    {
        fname: "Vikram",
        lname: "Kumar",
        email: "vikram@example.com",
        password: "password123",
        gender: "male",
        batch: "Sem 7",
        role: "user",
    },
    {
        fname: "Sneha",
        lname: "Reddy",
        email: "sneha@example.com",
        password: "password123",
        gender: "female",
        batch: "Sem 7",
        role: "user",
    },
    {
        fname: "Arjun",
        lname: "Nair",
        email: "arjun@example.com",
        password: "password123",
        gender: "male",
        batch: "Sem 1",
        role: "user",
    },
    {
        fname: "Kavya",
        lname: "Menon",
        email: "kavya@example.com",
        password: "password123",
        gender: "female",
        batch: "Sem 2",
        role: "user",
    },
    {
        fname: "Rahul",
        lname: "Joshi",
        email: "rahul@example.com",
        password: "password123",
        gender: "male",
        batch: "Sem 4",
        role: "user",
    },
];
const sampleMessages = [
    ["Hey! How are you?", "I'm good, thanks! How about you?"],
    ["What's up?", "Not much, just studying for exams."],
    [
        "Did you finish the assignment?",
        "Almost done, just the last question left.",
    ],
    ["Want to grab lunch?", "Sure! Let's meet at the canteen at 1."],
    ["Have you seen today's lecture notes?", "Yes, I can share them with you."],
    ["Good morning!", "Good morning! Ready for class?"],
    ["The project deadline is tomorrow!", "I know, working on it right now."],
    ["Can you help me with this problem?", "Of course, send me the details."],
    ["Are you coming to the event tonight?", "Wouldn't miss it!"],
    ["Happy birthday! 🎉", "Thank you so much! ❤️"],
];
async function seed() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected!\n");
    console.log("Clearing existing data...");
    await Promise.all([
        User.deleteMany({}),
        Conversation.deleteMany({}),
        Message.deleteMany({}),
    ]);
    console.log("Cleared.\n");
    const hashedPassword = await bcrypt.hash("password123", 10);
    const adminPassword = await bcrypt.hash("admin123", 10);
    console.log("Creating users...");
    const createdUsers = await User.insertMany(seedUsers.map((u) => ({
        ...u,
        password: u.role === "admin" ? adminPassword : hashedPassword,
        authProvider: "local",
        isProfileComplete: true,
    })));
    const admin = createdUsers[0];
    const regularUsers = createdUsers.slice(1);
    console.log(`  Created ${createdUsers.length} users (1 admin + ${regularUsers.length} regular)\n`);
    console.log("Creating conversations and messages...");
    const conversationPairs = [
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 8],
        [1, 5],
    ];
    let totalMessages = 0;
    for (let i = 0; i < conversationPairs.length; i++) {
        const [a, b] = conversationPairs[i];
        const userA = regularUsers[a];
        const userB = regularUsers[b];
        const conversation = await Conversation.create({
            participants: [userA._id, userB._id],
        });
        const msgPair = sampleMessages[i % sampleMessages.length];
        const messages = [];
        const baseTime = new Date();
        baseTime.setMinutes(baseTime.getMinutes() - (conversationPairs.length - i) * 30);
        const exchangeCount = 2 + Math.floor(Math.random() * 3);
        for (let j = 0; j < exchangeCount; j++) {
            const msgIndex = (i + j) % sampleMessages.length;
            const [textA, textB] = sampleMessages[msgIndex];
            const time1 = new Date(baseTime.getTime() + j * 10 * 60000);
            const time2 = new Date(time1.getTime() + 2 * 60000);
            messages.push({
                conversation: conversation._id,
                sender: userA._id,
                type: "text",
                text: textA,
                readBy: [userA._id, userB._id],
                createdAt: time1,
                updatedAt: time1,
            });
            messages.push({
                conversation: conversation._id,
                sender: userB._id,
                type: "text",
                text: textB,
                readBy: [userB._id, userA._id],
                createdAt: time2,
                updatedAt: time2,
            });
        }
        const createdMsgs = await Message.insertMany(messages);
        totalMessages += createdMsgs.length;
        await Conversation.findByIdAndUpdate(conversation._id, {
            lastMessage: createdMsgs[createdMsgs.length - 1]._id,
        });
        console.log(`  ${userA.fname} <-> ${userB.fname}: ${createdMsgs.length} messages`);
    }
    console.log(`\nSeed complete!`);
    console.log(`  Users:         ${createdUsers.length}`);
    console.log(`  Conversations: ${conversationPairs.length}`);
    console.log(`  Messages:      ${totalMessages}`);
    console.log(`\n── Login Credentials ──────────────────────────`);
    console.log(`  Admin:  admin@chatapp.com / admin123`);
    console.log(`  User:   aarav@example.com / password123`);
    console.log(`  User:   priya@example.com / password123`);
    console.log(`  (all regular users share password: password123)`);
    console.log(`───────────────────────────────────────────────\n`);
    await mongoose.disconnect();
    process.exit(0);
}
seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map