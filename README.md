# Clardot News – brèves à partir des publications AMF / info-financiere.gouv.fr

- Début : 2026-10-30 (heure de départ : 15:40h)

## 1. Choix techniques
- **Next.js 16 (App Router) + React 19 + TypeScript.** Un seul projet pour l'interface et le back-end (routes API).
- **Tailwind CSS 4.**
- **Supabase (PostgreSQL).** L'accès se fait uniquement côté serveur avec la clé `service_role` ; RLS est activé sans policy, donc la table n'est pas lisible depuis le navigateur.
- **Source de données : API OpenDataSoft Explore v2** d'info-financiere.gouv.fr.
- **LLM : Gemini** (palier gratuit de Google AI Studio).
- **Déploiement : Vercel**, branché sur le dépôt GitHub.
- **Outil de développement : Claude Code.**

## 2. Comment j'ai compris la structure des données
La « structure des données » désigne ici la façon dont est organisée l'information qui vient de l'API. Elle répond à ces questions :
- Quels champs contient chaque publication ?
- Que veut dire chaque champ ? Les noms sont cryptiques.
- Quels champs sont fiables, lesquels sont vides ou incohérents ?
- Comment identifier une publication de façon unique ?

Voici les données imparfaites trouvées :
- La même publication apparaît deux fois, en français et en anglais.
- Le type est trop large pour trier.
- Certains documents ne sont pas des PDF.
- Un même ISIN est partagé par plusieurs sociétés.

## 3. Critère de sélection
Score par règles (`src/lib/scoring.ts`) : somme de points selon le titre, le sous-type et le CAC 40. La raison de chaque sélection est affichée dans l'interface.

- **Bonus :** offre publique (+40), résultats / chiffre d'affaires (+30), opération de capital (+30), acquisition ou accord (+25), gouvernance (+25), alerte (+25), guidance (+20), CAC 40 (+20), chiffres dans le titre (+10).
- **Malus (routine) :** droits de vote (−60), honoraires des contrôleurs (−50), rachat d'actions (−40), mise à disposition de documents (−30), report de publication (−20).
- **Sélection :** 7 derniers jours, score ≥ 40, top 5, une publication par société (ce qui écarte aussi les jumeaux FR/EN).
- **Pourquoi des règles :** transparent, reproductible, gratuit.
- **Limites :** poids réglés à la main sur 5 jours, sans jeu annoté ; mots-clés parfois trompeurs ; score basé sur le titre, pas sur le document.

## 4. Contrôle des chiffres
## 5. Prompts clés et erreur de l'IA

Outil utilisé : Claude Code (dans VS Code).

### Prompts clés
1. **Cadrage / plan.** J'ai collé l'énoncé complet de l'exercice et demandé un plan par étapes avec des temps cibles (cible 4 h). Résultat : le plan en 9 étapes (préparation, exploration, ingestion, liste, sélection, brèves, vérification, déploiement, README).
2. **Gestion des risques.** Demander d'expliquer chaque étape pour la comprendre concrètement, et ne pas faire exécuter sans avoir pris conscience du risque pris.
3. **Génération des brèves** (prompt système envoyé à Gemini, dans `src/lib/llm.ts`) :
   > Tu es journaliste financier. Tu rédiges une brève d'actualité en français à partir d'un document réglementé.
   > - Utilise UNIQUEMENT les informations présentes dans le document fourni. N'invente rien, n'ajoute aucun contexte extérieur.
   > - Corps de la brève : entre 100 et 150 mots, style factuel, sans adjectifs promotionnels.
   > - Cite les chiffres clés exactement comme ils figurent dans le document (même valeur, même unité). Ne calcule pas de nouveau chiffre, n'arrondis pas.
   > - Si le document ne contient pas de chiffre, n'en mets pas.
   > - Dans "figures", liste chaque chiffre cité dans le corps, tel qu'écrit dans le corps.
   > - Le titre est informatif, 12 mots maximum.

   La sortie est un JSON imposé (`title`, `body`, `figures`) : la liste `figures` sert ensuite à vérifier les chiffres. Si le corps sort de la fourchette 100 à 150 mots, une seconde tentative est faite avec le décompte réel.

### Erreur de l'IA détectée
- **Champ d'API inventé.** Pour trier les publications par date, l'IA a écrit `order_by=date_de_publication desc`, un nom de champ deviné à partir de l'énoncé et non lu dans les données.
- **Comment je l'ai repérée :** le message d'erreur de l'API (ODSQLError), puis lecture d'un vrai enregistrement.

## 6. Améliorations
## 7. Temps passé
