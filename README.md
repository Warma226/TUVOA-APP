# TUVOA Studio

Plateforme personnelle de **TUVOA Tech Media** : veille tech, rédaction assistée par l'IA, visuels aux couleurs de la charte et publication sur WordPress, Facebook, LinkedIn et TikTok.

Tout se configure depuis un téléphone, dans le navigateur.

## Ce que fait l'application

| Écran | Rôle |
|---|---|
| **Accueil** | Posts à valider, planifiés, en erreur. Bouton **Manuel / Auto ON**. |
| **Veille** | Lit les sources (The Hacker News, Frandroid, TechCrunch, Sikafinance filtrée), classe par thème, regroupe les doublons, signale les sujets sensibles. |
| **Déclencheurs** | Règles qui transforment une actu en post. Mode général **OFF = Manuel** (aperçu obligatoire) ou **ON = Autopilote**. |
| **Créer** | Rubrique (#ActuTech, #CyberBase, #Portrait), idée, plateformes, rédaction par l'IA. |
| **Aperçu** | Éditeur par plateforme, compteur de caractères, assistant IA, visuel, planification ou publication. |
| **Comptes** | État des connexions (IA, base de données, réseaux). |

**Garde-fous de l'autopilote** (modifiables dans `lib/config.ts`) : 2 sources minimum sur le même sujet, 10 minutes pour annuler, 6 publications automatiques par jour au maximum, jamais d'automatique pour les sujets sensibles (décès, politique, justice…), portraits toujours en manuel. Les textes sont toujours reformulés et sourcés.

**Charte** : bleu `#2563EB`, orange `#E94A06`, police Archivo (licence libre) pour les visuels. Le logo officiel reste en Coolvetica : pour l'utiliser sur les visuels, mets une image PNG de ton logo en ligne et indique son adresse dans `LOGO_URL`.

## Mise en ligne (environ 30 minutes, depuis le téléphone)

### 1. Base de données : Supabase (gratuit)
1. Crée un compte sur supabase.com, puis un projet.
2. Ouvre **SQL Editor**, colle le contenu de `supabase/schema.sql`, appuie sur **Run**.
3. Dans **Project Settings › API**, note l'**URL** du projet et la clé **service_role** (elle reste secrète, ne la partage jamais).

Sans Supabase, l'application tourne en **mode démo** : les posts disparaissent à chaque redémarrage.

### 2. Hébergement : Vercel (gratuit)
1. Crée un compte sur vercel.com avec ton compte GitHub.
2. **Add New › Project**, choisis le dépôt `TUVOA-APP`, puis **Deploy**.
3. Dans **Settings › Environment Variables**, ajoute les variables ci-dessous, puis **Deployments › Redeploy**.

| Variable | Valeur |
|---|---|
| `APP_PASSWORD` | Le mot de passe de l'app (identifiant : `tuvoa`). **Obligatoire.** |
| `APP_SECRET` | Une longue suite de caractères au hasard. |
| `APP_URL` | L'adresse donnée par Vercel, sans `/` final. |
| `CRON_SECRET` | Une autre longue suite de caractères au hasard. |
| `ANTHROPIC_API_KEY` | Ta clé API, créée sur console.anthropic.com. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Les valeurs notées à l'étape 1. |

Ouvre ensuite l'adresse de l'app, connecte-toi, et ajoute-la à l'écran d'accueil du téléphone.

### 3. Veille automatique (toutes les 15 minutes)
Dans GitHub : **Settings › Secrets and variables › Actions › New repository secret**
- `TUVOA_URL` : l'adresse de l'app
- `TUVOA_CRON_SECRET` : la même valeur que `CRON_SECRET`

La tâche est dans `.github/workflows/tuvoa-cron.yml`. Tu peux la lancer à la main depuis l'onglet **Actions**.

### 4. Relier les comptes

**WordPress**
Dans ton WordPress : **Utilisateurs › Profil › Mots de passe d'application**, crée « TUVOA ». Puis dans Vercel :
`WP_URL` (ex. `https://www.tuvoa.media`), `WP_USER`, `WP_APP_PASSWORD`.

**Facebook (Page)**
1. Crée une application sur developers.facebook.com et relie ta Page TUVOA.
2. Obtiens un jeton de Page longue durée avec les permissions `pages_manage_posts` et `pages_read_engagement`.
3. Dans Vercel : `FB_PAGE_ID`, `FB_PAGE_TOKEN`.

**LinkedIn (Page entreprise)**
1. Crée une application sur developer.linkedin.com reliée à ta Page, et demande l'accès à la publication pour les organisations.
2. Dans Vercel : `LINKEDIN_TOKEN`, `LINKEDIN_AUTHOR` (forme `urn:li:organization:123456`).
3. Le jeton LinkedIn expire : il faudra le renouveler périodiquement.

**TikTok**
Demande l'accès « Content Posting API » sur developers.tiktok.com. La publication sera branchée une fois l'application validée par TikTok.

Lance les demandes Facebook, LinkedIn et TikTok tôt : leur validation peut prendre du temps.

## Modifier l'application

- **Sources, déclencheurs, garde-fous, guide de style de l'IA** : `lib/config.ts`
- **Gabarits des visuels** : `lib/visual.tsx`
- **Couleurs de l'interface** : `app/globals.css`

Chaque modification envoyée sur GitHub est remise en ligne automatiquement par Vercel.

## Technique

Next.js 15 (App Router), TypeScript, Supabase, rss-parser, `next/og` pour les visuels, API Claude pour la rédaction. Les liens des visuels sont signés ; toute l'application est protégée par mot de passe.
