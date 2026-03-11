# IntelScry Clone

Clone de la plateforme IntelScry — recherche OSINT multi-source avec authentification Discord OAuth2.

## Stack
- **Backend**: Node.js + Express
- **Auth**: Discord OAuth2 (passport-discord)
- **Hébergement**: Railway

## Setup rapide

### 1. Cloner et installer
```bash
npm install
cp .env.example .env
```

### 2. Créer une app Discord
1. Va sur https://discord.com/developers/applications
2. Crée une nouvelle application
3. Dans **OAuth2** → copie le `Client ID` et `Client Secret`
4. Ajoute le Redirect URI : `https://TON_APP.railway.app/auth/discord/callback`

### 3. Configurer `.env`
```
DISCORD_CLIENT_ID=ton_client_id
DISCORD_CLIENT_SECRET=ton_client_secret
DISCORD_CALLBACK_URL=https://ton_app.railway.app/auth/discord/callback
SESSION_SECRET=une_chaine_aleatoire_longue
```

### 4. Déployer sur Railway
```bash
# Installer Railway CLI
npm install -g @railway/cli

# Login et déployer
railway login
railway init
railway up
```

Puis dans Railway Dashboard → Variables → ajoute toutes les variables du `.env`.

### 5. Ajouter tes APIs
Ouvre `routes/api.js` et remplis les fonctions `apiHandlers.nomDeLaSource()` avec tes clés API.

## Structure
```
├── server.js           # Point d'entrée
├── routes/
│   ├── auth.js         # Discord OAuth routes
│   ├── api.js          # /api/search, /api/sources, /api/status
│   └── pages.js        # Pages HTML
├── middleware/
│   ├── passport.js     # Discord strategy
│   └── auth.js         # Protection des routes
└── public/
    ├── login.html      # Page de connexion
    └── app.html        # Dashboard principal
```

## Sources intégrées (à configurer)
- Snusbase, LeakCheck, HackCheck
- BreachBase, IntelVault, OathNet
- SEON, LeakOSINT, Inf0sec
- LeakSight, IntelX, Intelscry Stealer Logs
- Akula, IntelX Identity Portal, Telegram Scan
- xOsint, Infodra, Netium.vip, CamelHub
