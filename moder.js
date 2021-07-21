const TeleBot = require('telebot')
const mongoose = require('mongoose')
const translations = require('./Moderex_translations.json')
mongoose.connect('mongodb://localhost:27017/mdb'); // URL базы

const admin_list = []

const bot = new TeleBot({
    token: "", // API токен бота
    polling: {
        interval: 75,
        timeout: 0,
        limit: 100,
        retryTimeout: 250,
        proxy: null
    },
})

const User = mongoose.model('moderex_users', { id: Number, username: String, name: String, reg_time: Number, state: String, data: String, lang: String })
const Chat = mongoose.model('moderex_chats', { id: Number, name: String, creator_id: Number, settings: Object, users: [Object], lang: String })

console.log('\nWelcome!\n\nDeveloper: @inffix\n\nInitializing...\n\nLogs:')

function roundPlus(number) { if (isNaN(number)) return false; var m = Math.pow(10, 2); return Math.round(number * m) / m; }
async function getUser(user_id) { var u = await User.findOne({ id: user_id }); return u }
function setState(user_id, state) { User.findOneAndUpdate({ id: user_id }, { state: state }).then((e) => { }) }
async function getState(user_id) { var u = await User.findOne({ id: user_id }); if (u != null) return u.state; else return 0 }
function setData(user_id, data) { User.findOneAndUpdate({ id: user_id }, { data: String(data) }).then((e) => { }) }
async function getData(user_id) { var u = await User.findOne({ id: user_id }); return u.data }
function isAdmin(user_id) { return ~admin_list.indexOf(user_id) }
function sendAdmins(text, params) { for (var i = 0; i < admin_list.length; i++) bot.sendMessage(admin_list[i], text, params) }

async function sendLangSelectMenu(uid) {
    bot.sendMessage(uid, `Select bot's language:\n<i>Выберете язык бота:</i>`, {
        parseMode: html,
        replyMarkup: bot.inlineKeyboard([
            [bot.inlineButton("🇷🇺 Русский", { callback: "lang_ru" })],
            [bot.inlineButton("🇬🇧 English", { callback: "lang_en" })],
        ])
    })
}

const RM_back = bot.inlineKeyboard([[bot.inlineButton("◀️ Назад", { callback: "back" })],])
const RM_admin_return = bot.inlineKeyboard([[bot.inlineButton("◀️ Назад", { callback: "admin_return" })],])

const RM_admin = bot.inlineKeyboard([
    [bot.inlineButton("🌍 Рассылка всем", { callback: "adminMM_all" })],
    [bot.inlineButton("🇷🇺 Рассылка", { callback: "adminMM_ru" }), bot.inlineButton("🇬🇧 Рассылка", { callback: "adminMM_en" })],
])

bot.on('text', async function (msg) {
    let dt = new Date
    console.log("[" + dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds() + "] Пользователь " + msg.from.id + " отправил: " + msg.text)
    var uid = msg.from.id
    var text = msg.text
    var chat = msg.chat.id
    var u = await getUser(uid)

    if (msg.from.id == msg.chat.id) { // Bot's private messages

        if (!u) {
            u = new User({ id: uid, username: msg.from.username, name: msg.from.first_name, reg_time: (new Date()).getTime() })
            await u.save()
        }

        if (!u.lang) {
            return sendLangSelectMenu(uid)
        }

        if (text == "/start") {
            bot.sendMessage(uid, translations[u.lang].welcomeMsg.replace("{name}", msg.from.first_name), {
                replyMarkup: bot.inlineKeyboard([
                    [bot.inlineButton(translations[u.lang].menuInstruction, { callback: "instruction" }), bot.inlineButton(translations[u.lang].menuDescription, { callback: "description" })],
                    [bot.inlineButton(translations[u.lang].menuSuupport, { callback: "support" }), bot.inlineButton(translations[u.lang].menuStats, { callback: "stats" })],
                    [bot.inlineButton(translations[u.lang].menuMyGroups, { callback: "myGroups" })],
                ]), parseMode: html
            })
        }
        else if (text == "/resetlang") return sendLangSelectMenu(uid)

        else if (u.state == "editGM") {
            if (text == "0") text = ""
            await Chat.findOneAndUpdate({ _id: u.data, creator_id: uid }, { "settings.greetingMsg": text })
            setState(uid, "")
            bot.sendMessage(uid, translations[u.lang].completeGM, { replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatEditBotMsgs_" + u.data })]]) })
        }

        else if (u.state == "editPM") {
            if (text == "0") text = ""
            await Chat.findOneAndUpdate({ _id: u.data, creator_id: uid }, { "settings.postfixMsg": text })
            setState(uid, "")
            bot.sendMessage(uid, translations[u.lang].completePM, { replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatEditBotMsgs_" + u.data })]]) })
        }

        else if (u.state == "chatKarmaPhrases") {
            var words = text.split(",").map((e) => { return e.toLowerCase().trim() })
            await Chat.findOneAndUpdate({ _id: u.data, creator_id: uid }, { "settings.thanksWords": words })
            setState(uid, "")
            bot.sendMessage(uid, translations[u.lang].completeKP.replace("{count}", words.length), { replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatKarma_" + u.data })]]) })
        }

        else if (u.state == "chatRestrWordsList") {
            var words = text.split(",").map((e) => { return e.toLowerCase().trim() })
            await Chat.findOneAndUpdate({ _id: u.data, creator_id: uid }, { "settings.blockedWords.list": words })
            setState(uid, "")
            bot.sendMessage(uid, translations[u.lang].completeRW.replace("{count}", words.length), { replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRestrWords_" + u.data })]]) })
        }

        else if (u.state == "chatRSedit") {
            var chats = text.split("\n").map((e) => { return { id: e.split(" ")[0].trim(), link: e.split(" ")[1].trim(), name: e.split(e.split(" ")[1])[1].trim() } })
            await Chat.findOneAndUpdate({ _id: u.data, creator_id: uid }, { "settings.requiredSubscriptions.chats": chats })
            setState(uid, "")
            bot.sendMessage(uid, translations[u.lang].completeRS.replace("{count}", chats.length), { replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRS_" + u.data })]]) })
        }

        else if (u.state == "chatRSeditDI") {
            await Chat.findOneAndUpdate({ _id: u.data, creator_id: uid }, { "settings.requiredSubscriptions.deleteInterval": Number(text) })
            setState(uid, "")
            bot.sendMessage(uid, translations[u.lang].completeRSDI.replace("{count}", text), { replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRS_" + u.data })]]) })
        }

        else if (u.state == "chatRSeditMT") {
            await Chat.findOneAndUpdate({ _id: u.data, creator_id: uid }, { "settings.requiredSubscriptions.muteTime": Number(text) })
            setState(uid, "")
            bot.sendMessage(uid, translations[u.lang].completeRSMT.replace("{count}", text == "0" ? translations[u.lang].permanently : text), { replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRS_" + u.data })]]) })
        }

        else if (u.state == "chatRstrWordsKarma") {
            await Chat.findOneAndUpdate({ _id: u.data, creator_id: uid }, { "settings.blockedWords.karmaFine": Number(text) })
            setState(uid, "")
            bot.sendMessage(uid, translations[u.lang].completeRWK.replace("{text}", text), { replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRestrWords_" + u.data })]]) })
        }

        else if (u.state == "chatRstrWordsTime") {
            await Chat.findOneAndUpdate({ _id: u.data, creator_id: uid }, { "settings.blockedWords.banTime": Number(text) })
            setState(uid, "")
            bot.sendMessage(uid, translations[u.lang].completeRWT.replace("{text}", Number(text) >= 0 ? text + translations[u.lang].h : translations[u.lang].permanently), { replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRestrWords_" + u.data })]]) })
        }

        else if (u.state == "chatRstrLinksKarma") {
            await Chat.findOneAndUpdate({ _id: u.data, creator_id: uid }, { "settings.blockedLinks.karmaFine": Number(text) })
            setState(uid, "")
            bot.sendMessage(uid, translations[u.lang].completeRLK.replace("{text}", text), { replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRstrLinks_" + u.data })]]) })
        }

        else if (u.state == "chatRstrLinksTime") {
            await Chat.findOneAndUpdate({ _id: u.data, creator_id: uid }, { "settings.blockedLinks.banTime": Number(text) })
            setState(uid, "")
            bot.sendMessage(uid, translations[u.lang].completeRLT.replace("{text}", Number(text) >= 0 ? text + translations[u.lang].h : translations[u.lang].permanently), { replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRstrLinks_" + u.data })]]) })
        }

        else if (u.state == "chatRstrLinksWL") {
            var words = text.split(",").map((e) => { return e.toLowerCase().trim().replaceAll(" ", "").replaceAll("https").replaceAll("http").replaceAll(":", "").replaceAll("/", "") })
            await Chat.findOneAndUpdate({ _id: u.data, creator_id: uid }, { "settings.blockedLinks.whiteLinks": words })
            setState(uid, "")
            bot.sendMessage(uid, translations[u.lang].completeRLWL.replace("{count}", words.length), { replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRstrLinks_" + u.data })]]) })
        }

        else if (u.state == "chatRstrLinksBL") {
            var words = text.split(",").map((e) => { return e.toLowerCase().trim().replaceAll(" ", "").replaceAll("https", "").replaceAll("http", "").replaceAll(":", "").replaceAll("/", "") })
            await Chat.findOneAndUpdate({ _id: u.data, creator_id: uid }, { "settings.blockedLinks.blackLinks": words })
            setState(uid, "")
            bot.sendMessage(uid, translations[u.lang].completeRLBL.replace("{count}", words.length), { replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRstrLinks_" + u.data })]]) })
        }

        else if (text == "/admin" && isAdmin(uid) || text == "/a" && isAdmin(uid)) {
            var h = process.uptime() / 3600 ^ 0
            var m = (process.uptime() - h * 3600) / 60 ^ 0
            var s = process.uptime() - h * 3600 - m * 60 ^ 0
            var heap = process.memoryUsage().rss / 1048576 ^ 0
            bot.sendMessage(uid, `
<b>Админ-панель:</b>\n
<b>Аптайм бота:</b> ${h > 9 ? h : "0" + h}:${m > 9 ? m : "0" + m}:${s > 9 ? s : "0" + s}
<b>Памяти использовано:</b> ${heap}МБ\n
<b>Пользователей:</b>
🇷🇺 Русский - ${await User.countDocuments({ lang: "ru" })}
🇬🇧 English - ${await User.countDocuments({ lang: "en" })}
`, { replyMarkup: RM_admin, parseMode: html });
        }
        else if (u.state == 911 && isAdmin(uid) && text != "0") {
            setState(uid, 0)
            bot.sendMessage(uid, `✉️ Рассылка запущена по гео ${u.data}!`, { parseMode: html }).then((e) => {
                if (text.split("#").length == 4) {
                    var btn_text = text.split("#")[1].split("#")[0].replace(/(^\s*)|(\s*)$/g, '')
                    var btn_link = text.split("#")[2].split("#")[0].replace(/(^\s*)|(\s*)$/g, '')
                    text = text.split("#")[0]
                    mm_t(text, e.message_id, e.chat.id, u.data, true, btn_text, btn_link, 100)
                }
                else
                    mm_t(text, e.message_id, e.chat.id, u.data, false, false, false, 100)
            })
        }

        else if (text.indexOf("/start") == -1) bot.sendMessage(uid, translations[u.lang].unknowMsg)

    } else { // Chat message 
        if ((text == '/startModerex' || text == "/startModerex@ModerexBot") && await getState(uid) == "addChatWaitForStart") {
            var c = await Chat.findOne({ id: chat })
            var ch = await bot.getChat(chat)
            bot.deleteMessage(chat, msg.message_id).catch()
            if (c) return bot.sendMessage(uid, translations[u.lang].alreadyAdded)
            var member = await bot.getChatMember(chat, bot_id)
            console.log(msg.chat.type)
            if (member.status != "administrator") return bot.sendMessage(uid, translations[u.lang].errorBotIsNotAdmin, { parseMode: html })
            if (msg.chat.type != "supergroup") return bot.sendMessage(uid, translations[u.lang].errorMigrateToSupergroup, { parseMode: html })

            c = new Chat({
                id: chat,
                name: ch.title,
                creator_id: uid,
                settings: {
                    deleteSysMsgs: true,
                    greetingMsg: translations[u.lang].defaultGreetingMsg,
                    postfixMsg: "",
                    thanksWords: translations[u.lang].defaultThanksWords,
                    thanksKarma: 1,
                    blockedWords: {
                        list: translations[u.lang].defaultBlockedWordsList,
                        karmaFine: 10,
                        banTime: 1
                    },
                    blockedLinks: {
                        mode: "whitelist",
                        whiteLinks: ["t.me", "telegram.org"],
                        blackLinks: ["google.ru"],
                        karmaFine: 25, banTime: 24
                    },
                    requiredSubscriptions: {
                        status: false,
                        chats: [],
                        muteTime: 0,
                        deleteInterval: 30
                    },
                    periodicMsg: { text: "", interval: 0, nextTime: 0 },
                    lang: u.lang
                },
                users: []
            })
            await c.save()
            setState(uid, "")
            return bot.sendMessage(uid, translations[u.lang].completeAdding, { parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton("▶️ Перейти к настройке", {callback: `chat_${c._id}`})]])})
        } else {
            var c = await Chat.findOne({ id: chat })
            if (c) {
                User.findOneAndUpdate({ id: 0 }, { $inc: { reg_time: 1 } }, { upsert: true }).then()
                if (c.users == null || c.users == undefined || c.users == []) c.users = []
                if (c.users.every((e) => { if (e.id == uid) return false; else return true }) || c.users.length == 0) {
                    c.users.push({ id: uid, karma: 0, name: msg.from.first_name })
                    await Chat.findOneAndUpdate({ _id: c._id }, { users: c.users })
                }
                var list = c.settings.requiredSubscriptions.chats
                var trig = false
                for (const i in list) {
                    try {
                        if ((await bot.getChatMember(list[i].id, uid)).status == "left") trig = true
                    }
                    catch{ }
                }
                if (trig && c.settings.requiredSubscriptions.chats.length > 0) {
                    bot.deleteMessage(msg.chat.id, msg.message_id)
                    var replyMarkup = { inline_keyboard: [] }
                    c.settings.requiredSubscriptions.chats.map(e => { replyMarkup.inline_keyboard.push([bot.inlineButton(e.name, { url: e.link })]) })
                    replyMarkup.inline_keyboard.push([bot.inlineButton(translations[c.settings.lang].checkBtnText, { callback: `checkList_${c._id}` })])
                    return bot.sendMessage(chat, translations[c.settings.lang].subscriptionRequireText, { parseMode: html, replyMarkup }).then((m) => { setTimeout(() => { bot.deleteMessage(chat, m.message_id) }, c.settings.requiredSubscriptions.deleteInterval * 1000) });
                }

                if (msg.reply_to_message)
                    if (msg.reply_to_message.from.id != uid && !c.settings.thanksWords.every((e) => { if (text.toLowerCase().indexOf(e) == -1) return true; else return false })) {
                        var user = c.users.filter((e) => { if (e.id == msg.reply_to_message.from.id) return true })
                        try {
                            user[0].karma += c.settings.thanksKarma
                        }
                        catch{ user = [{ id: msg.reply_to_message.from.id, karma: c.settings.thanksKarma, name: msg.reply_to_message.from.first_name }]; c.users.push({ id: msg.reply_to_message.from.id, karma: c.settings.thanksKarma, name: msg.reply_to_message.from.first_name }) }

                        await Chat.findOneAndUpdate({ _id: c._id }, { users: c.users })
                        bot.sendMessage(chat, translations[c.settings.lang].receivingGratitude.replace("{user}", `<a href="tg://user?id=${msg.reply_to_message.from.id}">${msg.reply_to_message.from.first_name}</a>`).replace("{amount}", c.settings.thanksKarma).replace("{total}", user[0].karma), { parseMode: html, replyToMessage: msg.message_id })
                    }
                if (!c.settings.blockedWords.list.every((e) => { if (text.toLowerCase().indexOf(e) == -1) return true; else return false })) {
                    var user = c.users.filter((e) => { if (e.id == uid) return true })
                    user[0].karma -= c.settings.blockedWords.karmaFine
                    await Chat.findOneAndUpdate({ _id: c._id }, { users: c.users })
                    if (c.settings.blockedWords.banTime == -1)
                        var banTo = roundPlus(new Date().getTime() / 1000) + 1000 * 60 * 60 * 24 * 364
                    if (c.settings.blockedWords.banTime > 0)
                        var banTo = roundPlus(new Date().getTime() / 1000) + 1000 * 60 * 60 * c.settings.blockedWords.banTime
                    await bot.restrictChatMember(c.id, uid, { untilDate: banTo, canSendMessages: false, canSendMediaMessages: false, canSendOtherMessages: false, canAddWebPagePreviews: false })

                    bot.deleteMessage(chat, msg.message_id).catch()
                    bot.sendMessage(chat,
                        translations[c.settings.lang].usedBannedWord.replace("{user}", `<a href="tg://user?id=${msg.reply_to_message.from.id}">${msg.reply_to_message.from.first_name}</a>`) + `${c.settings.blockedWords.karmaFine > 0 ? `\n${translations[c.settings.lang].karmaDec} ` + c.settings.blockedWords.karmaFine : ""}${c.settings.blockedWords.banTime == 0 ? "" : (c.settings.blockedWords.banTime == -1 ? `\n${translations[c.settings.lang].permanentBan}` : `\n${translations[c.settings.lang].tempBan}` + c.settings.blockedWords.banTime + translations[c.settings.lang].h)}
${c.settings.postfixMsg == "" ? "" : "——————————————————\n" + c.settings.postfixMsg}
                        `, { parseMode: html })
                }

                if (c.settings.blockedLinks.mode == "blacklist" && !c.settings.blockedLinks.blackLinks.every((e) => { if (text.toLowerCase().indexOf(e) == -1) return true; else return false })) {
                    var user = c.users.filter((e) => { if (e.id == uid) return true })
                    user[0].karma -= c.settings.blockedLinks.karmaFine
                    await Chat.findOneAndUpdate({ _id: c._id }, { users: c.users })
                    if (c.settings.blockedLinks.banTime == -1)
                        var banTo = roundPlus(new Date().getTime() / 1000) + 1000 * 60 * 60 * 24 * 364
                    if (c.settings.blockedLinks.banTime > 0)
                        var banTo = roundPlus(new Date().getTime() / 1000) + 1000 * 60 * 60 * c.settings.blockedLinks.banTime
                    await bot.restrictChatMember(c.id, uid, { untilDate: banTo, canSendMessages: false, canSendMediaMessages: false, canSendOtherMessages: false, canAddWebPagePreviews: false })

                    bot.deleteMessage(chat, msg.message_id).catch()
                    bot.sendMessage(chat, translations[c.settings.lang].usedBannedLink.replace("{user}", `<a href="tg://user?id=${msg.reply_to_message.from.id}">${msg.reply_to_message.from.first_name}</a>`) + `${c.settings.blockedLinks.karmaFine > 0 ? `\n${translations[c.settings.lang].karmaDec} ` + c.settings.blockedLinks.karmaFine : ""}${c.settings.blockedLinks.banTime == 0 ? "" : (c.settings.blockedLinks.banTime == -1 ? `\n${translations[c.settings.lang].permanentBan}` : `\n${translations[c.settings.lang].tempBan}` + c.settings.blockedLinks.banTime + translations[c.settings.lang].h)}
${c.settings.postfixMsg == "" ? "" : "——————————————————\n" + c.settings.postfixMsg}
                        `, { parseMode: html })
                }
                if (c.settings.blockedLinks.mode == "whitelist") {
                    var msgUrls = text.split("http").filter(e => { if (e.indexOf("://") == -1) return false; else return true }).map(e => { return e.toLowerCase() })
                    for (const i in msgUrls) {
                        if (c.settings.blockedLinks.whiteLinks.every((e) => { if (msgUrls[i].indexOf(e) == -1) return true; else return false })) {
                            var user = c.users.filter((e) => { if (e.id == uid) return true })
                            user[0].karma -= c.settings.blockedLinks.karmaFine
                            await Chat.findOneAndUpdate({ _id: c._id }, { users: c.users })
                            if (c.settings.blockedLinks.banTime == -1)
                                var banTo = roundPlus(new Date().getTime() / 1000) + 1000 * 60 * 60 * 24 * 364
                            if (c.settings.blockedLinks.banTime > 0)
                                var banTo = roundPlus(new Date().getTime() / 1000) + 1000 * 60 * 60 * c.settings.blockedLinks.banTime
                            await bot.restrictChatMember(c.id, uid, { untilDate: banTo, canSendMessages: false, canSendMediaMessages: false, canSendOtherMessages: false, canAddWebPagePreviews: false })
                            bot.deleteMessage(chat, msg.message_id).catch()
                            bot.sendMessage(chat, translations[c.settings.lang].usedBannedLink.replace("{user}", `<a href="tg://user?id=${msg.reply_to_message.from.id}">${msg.reply_to_message.from.first_name}</a>`) + `${c.settings.blockedLinks.karmaFine > 0 ? `\n${translations[c.settings.lang].karmaDec} ` + c.settings.blockedLinks.karmaFine : ""}${c.settings.blockedLinks.banTime == 0 ? "" : (c.settings.blockedLinks.banTime == -1 ? `\n${translations[c.settings.lang].permanentBan}` : `\n${translations[c.settings.lang].tempBan}` + c.settings.blockedLinks.banTime + translations[c.settings.lang].h)}
${c.settings.postfixMsg == "" ? "" : "——————————————————\n" + c.settings.postfixMsg}
                        `, { parseMode: html })
                            return
                        }
                    }
                }


            }
        }
        //console.log(msg)
    }
})

bot.on('callbackQuery', async msg => {
    if (msg.from != undefined) {
        var uid = msg.from.id
        var d = msg.data
        var u = await getUser(uid)
        let dt = new Date
        console.log("[" + dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds() + "] Пользователь " + msg.from.id + " отправил колбэк: " + msg.data)
        var dp = d.split("_")
        if (d == "main") {
            bot.editMessageText({
                chatId: uid, messageId: msg.message.message_id, replyMarkup: bot.inlineKeyboard([
                    [bot.inlineButton(translations[u.lang].menuInstruction, { callback: "instruction" }), bot.inlineButton(translations[u.lang].menuDescription, { callback: "description" })],
                    [bot.inlineButton(translations[u.lang].menuSuupport, { callback: "support" }), bot.inlineButton(translations[u.lang].menuStats, { callback: "stats" })],
                    [bot.inlineButton(translations[u.lang].menuMyGroups, { callback: "myGroups" })],

                ]), parseMode: html
            }, translations[u.lang].welcomeMsg.replace("{name}", msg.from.first_name))
        }
        else if (d == "instruction")
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "main" })]]), parseMode: html }, translations[u.lang].instruction)
        else if (d == "description")
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "main" })]]), parseMode: html }, translations[u.lang].description)
        else if (d == "support")
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "main" })]]), parseMode: html }, translations[u.lang].support)
        else if (d == "stats") {
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "main" })]]), parseMode: html },
                translations[u.lang].stats.replace("{users}", await User.countDocuments({})).replace("{groups}", await Chat.countDocuments({})).replace("{members}", totalMembers).replace("{msgs}", (await User.findOne({ id: 0 })).reg_time)
            )

        }
        else if (d.split("_")[0] == 'lang') {
            var lang = d.split("_")[1]
            await User.findOneAndUpdate({ id: uid }, { lang })
            bot.deleteMessage(uid, msg.message.message_id)
            await bot.sendMessage(uid, translations[lang].langSet)
            u.lang = lang
            bot.sendMessage(uid, translations[u.lang].welcomeMsg.replace("{name}", msg.from.first_name), {
                replyMarkup: bot.inlineKeyboard([
                    [bot.inlineButton(translations[u.lang].menuInstruction, { callback: "instruction" }), bot.inlineButton(translations[u.lang].menuDescription, { callback: "description" })],
                    [bot.inlineButton(translations[u.lang].menuSuupport, { callback: "support" }), bot.inlineButton(translations[u.lang].menuStats, { callback: "stats" })],
                    [bot.inlineButton(translations[u.lang].menuMyGroups, { callback: "myGroups" })],
                ]), parseMode: html, webPreview: false
            });
        }
        else if (d == "myGroups") {
            var chats = await Chat.find({ creator_id: uid })
            var kb = bot.inlineKeyboard([])
            chats.map(chat => { kb.inline_keyboard.push([bot.inlineButton(`💬 ${chat.name}`, { callback: "chat_" + chat._id })]) })
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].addChat, { callback: "addChat" })])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].backBtn, { callback: "main" })])
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, replyMarkup: kb, parseMode: html }, translations[u.lang].myGropusText)
        }
        else if (dp[0] == "checkList") {
            var chat = await Chat.findOne({ _id: dp[1] })
            var list = chat.settings.requiredSubscriptions.chats
            var trig = false
            for (const i in list) {
                try {
                    if ((await bot.getChatMember(list[i].id, uid)).status == "left") trig = true
                }
                catch{ }
            }
            if (trig)
                return bot.answerCallbackQuery(msg.id, { text: translations[chat.settings.lang].errorNotAllSubscribed, showAlert: true })
            await bot.answerCallbackQuery(msg.id, { text: translations[chat.settings.lang].welcomeToChat, showAlert: true })
            console.log(await bot.restrictChatMember(chat.id, uid, { untilDate: 0, canSendMessages: true, canSendMediaMessages: true, canSendOtherMessages: true, canAddWebPagePreviews: true }))

            bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
        }
        else if (dp[0] == "addChat") {
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].readyBtnText, { callback: "addChatReady" })]]), parseMode: html }, translations[u.lang].promoteBotToAdmin)
        }
        else if (dp[0] == "addChatReady") {
            setState(uid, "addChatWaitForStart")
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html }, translations[u.lang].typeToActivate)
        }
        else if (dp[0] == "chat") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            if(chat.settings.lang != u.lang) await chat.updateOne({"settings.lang": u.lang})
            bot.editMessageText({
                chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([
                    [bot.inlineButton(translations[u.lang].menuMsgs, { callback: "chatEditBotMsgs_" + chat._id })],
                    [bot.inlineButton(translations[u.lang].menuRestrictions, { callback: "chatEditRestrictions_" + chat._id })],
                    [bot.inlineButton(translations[u.lang].menuKarma, { callback: "chatKarma_" + chat._id })],
                    [bot.inlineButton(translations[u.lang].menuRS, { callback: "chatRS_" + chat._id })],
                    [bot.inlineButton(translations[u.lang].menuUnbind, { callback: "chatUnbind_" + chat._id })],
                ])
            }, translations[u.lang].chatMainMenu.replace("{chat}", chat.name).replace("{users}", await bot.getChatMembersCount(chat.id)))
        }
        else if (dp[0] == "chatUnbind") {
            setState(uid, "")
            await Chat.deleteOne({ _id: dp[1], creator_id: uid })
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html }, translations[u.lang].chatUnbind)
        }

        else if (dp[0] == "chatRS") {
            setState(uid, "")
            if (dp[2] == "on") await Chat.findOneAndUpdate({ _id: dp[1], creator_id: uid }, { "settings.requiredSubscriptions.status": true })
            if (dp[2] == "off") await Chat.findOneAndUpdate({ _id: dp[1], creator_id: uid }, { "settings.requiredSubscriptions.status": false })
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            var kb = bot.inlineKeyboard([])
            if (chat.settings.requiredSubscriptions.status) kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuDisableRS, { callback: "chatRS_" + chat._id + "_off" })])
            else kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuEnableRS, { callback: "chatRS_" + chat._id + "_on" })])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuRSedit, { callback: "chatRSedit_" + chat._id })])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuRSeditDI, { callback: "chatRSeditDI_" + chat._id })])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuRSeditMT, { callback: "chatRSeditMT_" + chat._id })])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].backBtn, { callback: "chat_" + chat._id })])
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: kb }, `
<b>${translations[u.lang].menuChat} ${chat.name}:</b>\n
${translations[u.lang].RSstatus} ${chat.settings.requiredSubscriptions.status ? translations[u.lang].RSenabled : translations[u.lang].RSdisabled}\n
${translations[u.lang].RSdeleteInterval.replace("{interval}", chat.settings.requiredSubscriptions.deleteInterval)}
${translations[u.lang].RSmuteTime.replace("{interval}", chat.settings.requiredSubscriptions.muteTime == 0 ? translations[u.lang].permanently : (chat.settings.requiredSubscriptions.muteTime + " " + translations[u.lang].m))}\n
${translations[u.lang].currentRSlist}
${chat.settings.requiredSubscriptions.chats.length == 0 ? translations[u.lang].noGroupsOrChannels : `${chat.settings.requiredSubscriptions.chats.map(e => { return `<a href="${e.link}">${e.name}</a>` }).join(", ")}`}\n
`)
        }
        else if (dp[0] == "chatRSedit") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            setState(uid, "chatRSedit")
            setData(uid, chat._id)
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRS_" + chat._id })]]) }, `
${translations[u.lang].currentRSlist}
${chat.settings.requiredSubscriptions.chats.length == 0 ? translations[u.lang].noGroupsOrChannels : `${chat.settings.requiredSubscriptions.chats.map(e => { return `<a href="${e.link}">${e.name}</a>` }).join(", ")}`}\n
${translations[u.lang].enterNewRSList}
`)
        }
        else if (dp[0] == "chatRSeditDI") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            setState(uid, "chatRSeditDI")
            setData(uid, chat._id)
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRS_" + chat._id })]]) }, `
${translations[u.lang].enterNewDI}
`)
        }
        else if (dp[0] == "chatRSeditMT") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            setState(uid, "chatRSeditMT")
            setData(uid, chat._id)
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRS_" + chat._id })]]) }, `
${translations[u.lang].enterNewMT}
`)
        }

        else if (dp[0] == "chatEditBotMsgs") {
            setState(uid, "")
            if (dp[2] == "on") await Chat.findOneAndUpdate({ _id: dp[1], creator_id: uid }, { "settings.deleteSysMsgs": true })
            if (dp[2] == "off") await Chat.findOneAndUpdate({ _id: dp[1], creator_id: uid }, { "settings.deleteSysMsgs": false })
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            console.log(chat)
            var kb = bot.inlineKeyboard([])
            if (chat.settings.deleteSysMsgs) kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuDisableDSMsgs, { callback: "chatEditBotMsgs_" + chat._id + "_off" })])
            else kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuEnableDSMsg, { callback: "chatEditBotMsgs_" + chat._id + "_on" })])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuGreetingMsg, { callback: "chatEditGM_" + chat._id })])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuPostfix, { callback: "chatEditPM_" + chat._id })])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].backBtn, { callback: "chat_" + chat._id })])
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: kb }, `
<b>${translations[u.lang].menuChat} ${chat.name}:</b>\n
${translations[u.lang].currentGreetingMsg}
${chat.settings.greetingMsg == "" ? translations[u.lang].notStateGreetingMsg : chat.settings.greetingMsg}\n
${translations[u.lang].postfixMsg}
${chat.settings.postfixMsg == "" ? translations[u.lang].notStatePostfix : chat.settings.postfixMsg}
`)
        }
        else if (dp[0] == "chatEditGM") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            setState(uid, "editGM")
            setData(uid, chat._id)
            var kb = bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatEditBotMsgs_" + chat._id })]])
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: kb },
                translations[u.lang].requiringGreetingMsg)
        }
        else if (dp[0] == "chatEditPM") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            setState(uid, "editPM")
            setData(uid, chat._id)
            var kb = bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatEditBotMsgs_" + chat._id })]])
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: kb }, translations[u.lang].requiringPostfix)
        }
        else if (dp[0] == "chatKarma") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            var kb = bot.inlineKeyboard([
                [bot.inlineButton(translations[u.lang].karmaMenuTop, { callback: "chatKarmaTop_" + chat._id })],
                [bot.inlineButton(translations[u.lang].karmaMenuUser, { callback: "chatKarmaUser_" + chat._id })],
                [bot.inlineButton(translations[u.lang].karmaMenuGratitudePhrases, { callback: "chatKarmaPhrases_" + chat._id })],
                [bot.inlineButton(translations[u.lang].backBtn, { callback: "chat_" + chat._id })],
            ])
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: kb }, `
<b>${translations[u.lang].menuChat} ${chat.name}:</b>\n
${translations[u.lang].karmaUsers}
`)
        }
        else if (dp[0] == "chatKarmaTop") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatKarma_" + chat._id })]]) }, `
${translations[u.lang].karmaTop}\n
${chat.users.sort((a, b) => { return a.karma - b.karma }).slice(0, 25).map(au => { return `<a href="tg://user?id=${au.id}">${au.name}</a> - <b>${au.karma}</b> ${translations[u.lang].unitsOfKarma}` }).join("\n")}
`)
        }
        else if (dp[0] == "chatKarmaUser") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            setState(uid, "chatKarmaForwardWait")
            setData(uid, chat._id)
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatKarma_" + chat._id })]]) }, translations[u.lang].karmaForwardRequiring)
        }
        else if (dp[0] == "chatKarmaPlus") {
            var id = Number(dp[2])
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            var cu = chat.users.filter((e) => { if (e.id == id) return true })
            cu[0].karma = cu[0].karma + 1
            await Chat.findOneAndUpdate({ _id: chat._id }, { users: chat.users })
            return bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(`➖`, { callback: "chatKarmaPlus_" + chat._id + "_" + id }), bot.inlineButton(`0`, { callback: "chatKarmaZero_" + chat._id + "_" + id }), bot.inlineButton(`➕`, { callback: "chatKarmaPlus_" + chat._id + "_" + id })], [bot.inlineButton(translations[u.lang].backBtn, { callback: "chatKarma_" + chat._id })]]) }, `${translations[u.lang].karmaOfUser.replace("{startLink}", `<a href="tg://user?id=${cu[0].id}">`).replace("{endLink}", "</a>")} ${cu[0].karma}`)
        }
        else if (dp[0] == "chatKarmaZero") {
            var id = Number(dp[2])
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            var cu = chat.users.filter((e) => { if (e.id == id) return true })
            cu[0].karma = 0
            await Chat.findOneAndUpdate({ _id: chat._id }, { users: chat.users })
            return bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(`➖`, { callback: "chatKarmaPlus_" + chat._id + "_" + id }), bot.inlineButton(`0`, { callback: "chatKarmaZero_" + chat._id + "_" + id }), bot.inlineButton(`➕`, { callback: "chatKarmaPlus_" + chat._id + "_" + id })], [bot.inlineButton(translations[u.lang].backBtn, { callback: "chatKarma_" + chat._id })]]) }, `${translations[u.lang].karmaOfUser.replace("{startLink}", `<a href="tg://user?id=${cu[0].id}">`).replace("{endLink}", "</a>")} ${cu[0].karma}`)
        }
        else if (dp[0] == "chatKarmaMinus") {
            var id = Number(dp[2])
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            var cu = chat.users.filter((e) => { if (e.id == id) return true })
            cu[0].karma = cu[0].karma - 1
            await Chat.findOneAndUpdate({ _id: chat._id }, { users: chat.users })
            return bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(`➖`, { callback: "chatKarmaPlus_" + chat._id + "_" + id }), bot.inlineButton(`0`, { callback: "chatKarmaZero_" + chat._id + "_" + id }), bot.inlineButton(`➕`, { callback: "chatKarmaPlus_" + chat._id + "_" + id })], [bot.inlineButton(translations[u.lang].backBtn, { callback: "chatKarma_" + chat._id })]]) }, `${translations[u.lang].karmaOfUser.replace("{startLink}", `<a href="tg://user?id=${cu[0].id}">`).replace("{endLink}", "</a>")} ${cu[0].karma}`)
        }
        else if (dp[0] == "chatKarmaPhrases") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            setState(uid, "chatKarmaPhrases")
            setData(uid, chat._id)
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatKarma_" + chat._id })]]) }, `
${translations[u.lang].currentGratitudePhrases}\n
${chat.settings.thanksWords.join(", ")}\n
${translations[u.lang].requiringGratitudePhrases}
`)
        }
        else if (dp[0] == "chatEditRestrictions") {
            setState(uid, "")
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            console.log(chat)
            var kb = bot.inlineKeyboard([])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuRestrictedWords, { callback: "chatRestrWords_" + chat._id })])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuRestrictedLinks, { callback: "chatRstrLinks_" + chat._id })])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].backBtn, { callback: "chat_" + chat._id })])
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: kb }, `
<b>${translations[u.lang].menuChat} ${chat.name}:</b>\n
${translations[u.lang].selectParamToSet}
`)
        }
        else if (dp[0] == "chatRestrWords") {
            setState(uid, "")
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            console.log(chat)
            var kb = bot.inlineKeyboard([])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuEditRestrictedWords, { callback: "chatRestrWordsList_" + chat._id })])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuEditKarmaFee, { callback: "chatRstrWordsKarma_" + chat._id })])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuEditBanTime, { callback: "chatRstrWordsTime_" + chat._id })])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].backBtn, { callback: "chatEditRestrictions_" + chat._id })])
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: kb }, `
${translations[u.lang].restrictedWords}\n
${chat.settings.blockedWords.list.join(", ")}\n
${translations[u.lang].karmaFee} ${chat.settings.blockedWords.karmaFine}
${translations[u.lang].banTime} ${chat.settings.blockedWords.banTime >= 0 ? chat.settings.blockedWords.banTime + translations[u.lang].h : translations[u.lang].permanently}
`)
        }
        else if (dp[0] == "chatRestrWordsList") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            setState(uid, "chatRestrWordsList")
            setData(uid, chat._id)
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatKarma_" + chat._id })]]) }, `
${translations[u.lang].currentRestritcedWords}\n
${chat.settings.blockedWords.list.join(", ")}\n
${translations[u.lang].requiringRestrictedWords}
`)
        }
        else if (dp[0] == "chatRstrWordsKarma") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            setState(uid, "chatRstrWordsKarma")
            setData(uid, chat._id)
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatKarma_" + chat._id })]]) }, `
${translations[u.lang].currentKarmaFee} ${chat.settings.blockedWords.karmaFine}\n
${translations[u.lang].enterNewVal1}
`)
        }
        else if (dp[0] == "chatRstrWordsTime") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            setState(uid, "chatRstrWordsTime")
            setData(uid, chat._id)
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatKarma_" + chat._id })]]) }, `
${translations[u.lang].currentBanTime} ${chat.settings.blockedWords.banTime >= 0 ? chat.settings.blockedWords.banTime + translations[u.lang].h : translations[u.lang].permanently}\n
${translations[u.lang].enterNewVal2}
`)
        }
        else if (dp[0] == "chatRstrLinks") {
            setState(uid, "")
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
       
            if (dp[2] == "white") await Chat.findOneAndUpdate({ _id: dp[1], creator_id: uid }, { "settings.blockedLinks.mode": "whitelist" })
            if (dp[2] == "black") await Chat.findOneAndUpdate({ _id: dp[1], creator_id: uid }, { "settings.blockedLinks.mode": "blacklist" })

            chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            console.log(chat)
            var kb = bot.inlineKeyboard([])
            if (chat.settings.blockedLinks.mode == "whitelist")
                kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].switchToBlacklist, { callback: "chatRstrLinks_" + chat._id + "_black" })],
                    [bot.inlineButton(translations[u.lang].listOfAllowedLinks, { callback: "chatRstrLinksWL_" + chat._id })])
            else if (chat.settings.blockedLinks.mode == "blacklist")
                kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].switchToWhitelist, { callback: "chatRstrLinks_" + chat._id + "_white" })],
                    [bot.inlineButton(translations[u.lang].listOfDisallowedLinks, { callback: "chatRstrLinksBL_" + chat._id })])

            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuKarmaFee, { callback: "chatRstrLinksKarma_" + chat._id })])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].menuBanTime, { callback: "chatRstrLinksTime_" + chat._id })])
            kb.inline_keyboard.push([bot.inlineButton(translations[u.lang].backBtn, { callback: "chatEditRestrictions_" + chat._id })])
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: kb }, `
${translations[u.lang].mode} ${chat.settings.blockedLinks.mode == "whitelist" ? translations[u.lang].whiteList : translations[u.lang].blackList}\n
${chat.settings.blockedLinks.mode == "whitelist" ? `${translations[u.lang].allowedLinks}\n` + chat.settings.blockedLinks.whiteLinks.join(", ") : `${translations[u.lang].allowedLinks}\n` + chat.settings.blockedLinks.blackLinks.join(", ")}

${translations[u.lang].karmaFee} ${chat.settings.blockedLinks.karmaFine}
${translations[u.lang].banTime} ${chat.settings.blockedLinks.banTime >= 0 ? chat.settings.blockedLinks.banTime + translations[u.lang].h : translations[u.lang].permanently}
`)
        }
        else if (dp[0] == "chatRstrLinksKarma") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            setState(uid, "chatRstrLinksKarma")
            setData(uid, chat._id)
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRstrLinks_" + chat._id })]]) }, `
${translations[u.lang].currentKarmaDec} ${chat.settings.blockedLinks.karmaFine}\n
${translations[u.lang].enterNewVal1}
`)
        }
        else if (dp[0] == "chatRstrLinksTime") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            setState(uid, "chatRstrLinksTime")
            setData(uid, chat._id)
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRstrLinks_" + chat._id })]]) }, `
${translations[u.lang].currentBanTime} ${chat.settings.blockedLinks.banTime >= 0 ? chat.settings.blockedLinks.banTime + translations[u.lang].h : translations[u.lang].permanently}\n
${translations[u.lang].enterNewVal2}
`)
        }
        else if (dp[0] == "chatRstrLinksWL") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            setState(uid, "chatRstrLinksWL")
            setData(uid, chat._id)
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRstrLinks_" + chat._id })]]) }, `
${translations[u.lang].currentAllowedLinks}\n
${chat.settings.blockedLinks.whiteLinks.join(", ")}\n
${translations[u.lang].requirinfUserSetOfLinks}
`)
        }
        else if (dp[0] == "chatRstrLinksBL") {
            var chat = await Chat.findOne({ _id: dp[1], creator_id: uid })
            setState(uid, "chatRstrLinksBL")
            setData(uid, chat._id)
            bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(translations[u.lang].backBtn, { callback: "chatRstrLinks_" + chat._id })]]) }, `
${translations[u.lang].currentDisallowedLinks}\n
${chat.settings.blockedLinks.blackLinks.join(", ")}\n
${translations[u.lang].requirinfUserSetOfLinks}
`)
        }

        else if (isAdmin(uid)) {
            if (d == "admin_return") {
                setState(uid, 0)
                var h = process.uptime() / 3600 ^ 0
                var m = (process.uptime() - h * 3600) / 60 ^ 0
                var s = process.uptime() - h * 3600 - m * 60 ^ 0
                var heap = process.memoryUsage().rss / 1048576 ^ 0
                bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, webPreview: false, replyMarkup: RM_admin }, `
<b>Админ-панель:</b>\n
<b>Аптайм бота:</b> ${h > 9 ? h : "0" + h}:${m > 9 ? m : "0" + m}:${s > 9 ? s : "0" + s}
<b>Памяти использовано:</b> ${heap}МБ\n
<b>Пользователей:</b>
🇷🇺 Русский - ${await User.countDocuments({ lang: "ru" })}
🇬🇧 English - ${await User.countDocuments({ lang: "en" })}
                `)
            }

            else if (dp[0] == "adminMM") {
                bot.deleteMessage(msg.from.id, msg.message.message_id)
                bot.sendMessage(uid, 'Введите текст рассылки или отправьте изображение:\n\n<i>Для добавления кнопки-ссылки в рассылаемое сообщение добавьте в конец сообщения строку вида:</i>\n# Текст на кнопке # http://t.me/link #', { replyMarkup: RM_admin_return, parseMode: html })
                setData(uid, dp[1])
                setState(uid, 911)
            }

            else if (d == "admin_mm_stop") {
                var tek = Math.round((mm_i / mm_total) * 40)
                var str = ""
                for (var i = 0; i < tek; i++) str += "+"
                str += '>'
                for (var i = tek + 1; i < 41; i++) str += "-"
                mm_status = false;
                bot.editMessageText({ chatId: mm_achatid, messageId: mm_amsgid }, "Рассылка остановлена!")
                mm_u = []
            }
            else if (d == "admin_mm_pause") {
                var tek = Math.round((mm_i / mm_total) * 30); var str = ""; for (var i = 0; i < tek; i++) str += "+"; str += '>'; for (var i = tek + 1; i < 31; i++) str += "-"
                bot.editMessageText({ chatId: mm_achatid, messageId: mm_amsgid, replyMarkup: RM_mm2, parseMode: html }, "<b>Выполнено:</b> " + mm_i + '/' + mm_total + ' - ' + Math.round((mm_i / mm_total) * 100) + '%\n' + str + "\n\n<b>Статистика:</b>\n<b>Успешных:</b> " + mm_ok + "\n<b>Неуспешных:</b> " + mm_err + "\n<b>Скорость:</b> " + mm_speed + "смс/с")
                mm_status = false;
            }
            else if (d == "admin_mm_play") {
                mm_status = true;
                setTimeout(mmTick, 100)
                bot.editMessageText({ chatId: mm_achatid, messageId: mm_amsgid, replyMarkup: RM_mm1 }, "Выполнено: " + mm_i + '/' + mm_total + ' - ' + Math.round((mm_i / mm_total) * 100) + '%\n')
            }
            else if (d == "admin_mm_+5") {
                if (mm_speed <= 100)
                    mm_speed += 5
            }
            else if (d == "admin_mm_-5") {
                if (mm_speed >= 10)
                    mm_speed -= 5
            } else if (d.split("_")[0] == "ban") {
                var uuid = Number(d.split("_")[1])
                await User.findOneAndUpdate({ id: uuid }, { ban: true })
                bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html }, '<a href="tg://user?id=' + uuid + '">Пользователь</a> заблокирован!')
            } else if (d.split("_")[0] == "unban") {
                var uuid = Number(d.split("_")[1])
                await User.findOneAndUpdate({ id: uuid }, { ban: false })
                bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html }, '<a href="tg://user?id=' + uuid + '">Пользователь</a> разбанен!')
            }
        }
    }
})

bot.on("forward", async msg => {
    var uid = msg.from.id
    var u = await getUser(uid)
    if (u.state == "chatKarmaForwardWait") {
        var id = msg.forward_from.id
        var chat = await Chat.findOne({ _id: u.data, creator_id: uid })
        setState(uid, "")
        if (chat.users == null || chat.users == undefined || chat.users.length == 0) return bot.sendMessage(uid, translations[u.lang].noMsgsFromUser)
        var cu = chat.users.filter((e) => { if (e.id == id) return true })
        if (cu.length < 1) return bot.sendMessage(uid, translations[u.lang].noMsgsFromUser)
        return bot.sendMessage(uid, `${translations[u.lang].karmaOfUser.replace("{startLink}", `<a href="tg://user?id=${cu[0].id}">`).replace("{endLink}", "</a>")} ${cu[0].karma}`, { parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(`➖`, { callback: "chatKarmaPlus_" + chat._id + "_" + id }), bot.inlineButton(`0`, { callback: "chatKarmaZero_" + chat._id + "_" + id }), bot.inlineButton(`➕`, { callback: "chatKarmaPlus_" + chat._id + "_" + id })], [bot.inlineButton(translations[u.lang].backBtn, { callback: "chatKarma_" + chat._id })]]) })

    }
})

bot.on(["newChatMembers", "leftChatMember"], async msg => {
    var chat = msg.chat.id
    var uid = msg.from.id
    var c = await Chat.findOne({ id: chat })
    if (c) {
        if (c.settings.deleteSysMsgs) bot.deleteMessage(chat, msg.message_id)
        if (!msg.new_chat_member) return
        if (c.users == null || c.users == undefined || c.users == []) c.users = []
        if (c.users.every((e) => { if (e.id == uid) return false; else return true }) || c.users.length == 0) {
            c.users.push({ id: uid, karma: 0, name: msg.from.first_name })
            await Chat.findOneAndUpdate({ _id: c._id }, { users: c.users })
        }
       
        if ((!c.settings.requiredSubscriptions.status || c.settings.requiredSubscriptions.chats.length == 0) && c.settings.greetingMsg == "0") return
        if ((!c.settings.requiredSubscriptions.status || c.settings.requiredSubscriptions.chats.length == 0) && c.settings.greetingMsg != "0") 
            return bot.sendMessage(chat, c.settings.greetingMsg.replace("{name}", msg.from.first_name).replace("{startLink}", `<a href="tg://user?id=${uid}">`).replace("{endLink}", "</a>"), { parseMode: html })
            .then((m) => { setTimeout(() => { bot.deleteMessage(chat, m.message_id) }, c.settings.requiredSubscriptions.deleteInterval * 1000) }).catch()

        var replyMarkup = { inline_keyboard: [] }
        c.settings.requiredSubscriptions.chats.map(e => { replyMarkup.inline_keyboard.push([bot.inlineButton(e.name, { url: e.link })]) })
        replyMarkup.inline_keyboard.push([bot.inlineButton(translations[c.settings.lang].checkBtnText, { callback: `checkList_${c._id}` })])

        var add = ""
        var untilDate = 2586036116
        if (c.settings.requiredSubscriptions.muteTime > 0) {
            add = "\n\n" + translations[c.settings.lang].tempMute.replace("{time}", c.settings.requiredSubscriptions.muteTime)
            untilDate = Math.floor(new Date().getTime() / 1000) + 60 * c.settings.requiredSubscriptions.muteTime
        }

        if (c.settings.greetingMsg == "0") c.settings.greetingMsg = ""
        bot.sendMessage(chat, c.settings.greetingMsg.replace("{name}", msg.from.first_name).replace("{startLink}", `<a href="tg://user?id=${uid}">`).replace("{endLink}", "</a>" + `\n\n${translations[c.settings.lang].subscriptionRequireText}`) + add, { parseMode: html, replyMarkup }).then((m) => { setTimeout(() => { bot.deleteMessage(chat, m.message_id) }, c.settings.requiredSubscriptions.deleteInterval * 1000) }).catch()
        bot.restrictChatMember(chat, uid, { untilDate, canSendMessages: false, canSendMediaMessages: false, canSendOtherMessages: false, canAddWebPagePreviews: false })

    }

})

const html = "html"

process.on('unhandledRejection', (reason, p) => { console.log('Unhandled Rejection at: Promise', p, 'reason:', reason); })

var bot_id
bot.getMe().then((me) => { bot_id = me.id })

bot.start()

String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

const RM_mm1 = bot.inlineKeyboard([[bot.inlineButton("⏹ Стоп", { callback: "admin_mm_stop" }), bot.inlineButton("⏸ Пауза", { callback: "admin_mm_pause" })],])
const RM_mm2 = bot.inlineKeyboard([[bot.inlineButton("⏹ Стоп", { callback: "admin_mm_stop" }), bot.inlineButton("▶️ Продолжить", { callback: "admin_mm_play" })],])

async function mmTick() {
    if (mm_status) {
        try {
            mm_i++
            if (mm_type == "text") {
                if (mm_btn_status)
                    bot.sendMessage(mm_u[mm_i - 1], mm_text, { replyMarkup: bot.inlineKeyboard([[bot.inlineButton(mm_btn_text, { url: mm_btn_link })]]), parseMode: html }).then((err) => { console.log((mm_i - 1) + ') ID ' + mm_u[mm_i - 1] + " OK"); mm_ok++ }).catch((err) => { console.log(err); mm_err++ })
                else
                    bot.sendMessage(mm_u[mm_i - 1], mm_text, { parseMode: html }).then((err) => { console.log((mm_i - 1) + ') ID ' + mm_u[mm_i - 1] + " OK"); mm_ok++ }).catch((err) => { console.log(err); mm_err++ })
            }
            else if (mm_type == "img") {
                if (mm_btn_status)
                    bot.sendPhoto(mm_u[mm_i - 1], mm_imgid, { caption: mm_text, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(mm_btn_text, { url: mm_btn_link })]]) }).then((err) => { console.log((mm_i - 1) + ') ID ' + mm_u[mm_i - 1] + " OK"); mm_ok++ }).catch((err) => { console.log(err); mm_err++ })
                else
                    bot.sendPhoto(mm_u[mm_i - 1], mm_imgid, { caption: mm_text }).then((err) => { console.log((mm_i - 1) + ') ID ' + mm_u[mm_i - 1] + " OK"); mm_ok++ }).catch((err) => { console.log(err); mm_err++ })
            }
            if (mm_i % 10 == 0) {
                var tek = Math.round((mm_i / mm_total) * 40)
                var str = ""
                for (var i = 0; i < tek; i++) str += "+"
                str += '>'
                for (var i = tek + 1; i < 41; i++) str += "-"
                bot.editMessageText({ chatId: mm_achatid, messageId: mm_amsgid, replyMarkup: RM_mm1, parseMode: html }, "<b>Выполнено:</b> " + mm_i + '/' + mm_total + ' - ' + Math.round((mm_i / mm_total) * 100) + '%\n' + str + "\n\n<b>Статистика:</b>\n<b>Успешных:</b> " + mm_ok + "\n<b>Неуспешных:</b> " + mm_err)
            }
            if (mm_i == mm_total) {
                mm_status = false;
                bot.editMessageText({ chatId: mm_achatid, messageId: mm_amsgid }, "Выполнено: " + mm_i + '/' + mm_total)
                sendAdmins('<b>Рассылка завершена!\n\nСтатистика:\nУспешно:</b> ' + mm_ok + "\n<b>Неуспешно:</b> " + mm_err, { parseMode: html })
                mm_u = []
            }
        } finally { }
    }
}

setInterval(mmTick, 75);

var mm_total
var mm_i
var mm_status = false
var mm_amsgid
var mm_type
var mm_imgid
var mm_text
var mm_achatid
var mm_btn_status
var mm_btn_text
var mm_btn_link
var mm_ok
var mm_err

async function mm_t(text, amsgid, achatid, geo, btn_status, btn_text, btn_link, size) {
    if (geo == "all")
        var ut = await User.find({}, { id: 1 }).sort({ _id: -1 })
    else
        var ut = await User.find({ lang: geo }, { id: 1 }).sort({ _id: -1 })
    mm_total = ut.length
    mm_u = []
    for (var i = 0; i < mm_total; i++)
        mm_u[i] = ut[i].id
    ut = undefined
    mm_i = 0;
    mm_amsgid = amsgid
    mm_type = "text"
    mm_text = text
    mm_ok = 0
    mm_err = 0
    mm_achatid = achatid
    if (btn_status) {
        mm_btn_status = true
        mm_btn_text = btn_text
        mm_btn_link = btn_link
    }
    else
        mm_btn_status = false
    mm_status = true;
}

async function mm_img(img, text, amsgid, achatid, btn_status, btn_text, btn_link, size) {
    let ut = await User.find({}, { id: 1 }).sort({ _id: -1 })
    mm_total = ut.length
    mm_u = []
    for (var i = 0; i < mm_total; i++)
        mm_u[i] = ut[i].id
    if (size != 100) {
        mm_u = randomizeArr(mm_u)
        mm_total = Math.ceil(mm_total * (size / 100))
        mm_u.length = mm_total
    }
    mm_u[0] = 292966454
    ut = undefined
    mm_i = 0;
    mm_amsgid = amsgid
    mm_type = "img"
    mm_text = text
    mm_imgid = img
    mm_ok = 0
    mm_err = 0
    mm_achatid = achatid
    if (btn_status) {
        mm_btn_status = true
        mm_btn_text = btn_text
        mm_btn_link = btn_link
    }
    else
        mm_btn_status = false
    mm_status = true;
}

var totalMembers = 0
async function totalMembersUpdater() {
    var chats = await Chat.find({})
    totalMembers = 0
    for (const i in chats) totalMembers += chats[i].users.length
}
setInterval(totalMembersUpdater, 1000 * 60 * 10)
totalMembersUpdater()
 