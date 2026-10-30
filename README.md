# Clardot News – brèves à partir des publications AMF / info-financiere.gouv.fr

- Début : 2026-10-30 (heure de départ : 15 h 40)

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
Chaque brève est comparée au texte du PDF source (`src/lib/verify.ts`), juste après sa génération.

1. On extrait tous les nombres du corps de la brève par regex
2. On normalise les formats français
3. On cherche chaque nombre dans le texte du document :
   - ✅ **vérifié** : le nombre est trouvé
   - ⚠️ **non vérifiable** : valeur proche dans le document
   - ❌ **absent** : le nombre n'existe pas dans le document

## 5. Prompts clés et erreur de l'IA

Outil utilisé : Claude Code (dans VS Code).

### Prompts clés
1. **Cadrage / plan.** J'ai collé l'énoncé complet de l'exercice et demandé un plan par étapes avec des temps cibles (cible 4 h). Résultat : le plan en 9 étapes (préparation, exploration, ingestion, liste, sélection, brèves, vérification, déploiement, README).
2. **Gestion des risques.** Demander d'expliquer chaque étape pour la comprendre concrètement, et ne pas faire exécuter sans avoir pris conscience du risque.
3. **Génération des brèves** (prompt système envoyé à Gemini, dans `src/lib/llm.ts`) :
   > Tu es journaliste financier. Tu rédiges une brève d'actualité en français à partir d'un document réglementé.
   > - Utilise UNIQUEMENT les informations présentes dans le document fourni. N'invente rien, n'ajoute aucun contexte extérieur.
   > - Corps de la brève : entre 100 et 150 mots, style factuel, sans adjectifs promotionnels.
   > - Cite les chiffres clés exactement comme ils figurent dans le document (même valeur, même unité). Ne calcule pas de nouveau chiffre, n'arrondis pas.
   > - Si le document ne contient pas de chiffre, n'en mets pas.
   > - Dans "figures", liste chaque chiffre cité dans le corps, tel qu'écrit dans le corps.
   > - Le titre est informatif, 12 mots maximum.

### Erreur de l'IA détectée
- **Champ d'API inventé.** Pour trier les publications par date, l'IA a écrit `order_by=date_de_publication desc`, un nom de champ deviné à partir de l'énoncé et non lu dans les données.
- **Comment je l'ai repérée :** grâce au message d'erreur de l'API (ODSQLError).

**Seconde erreur : un quota épuisé traité comme une surcharge passagère.** Le code généré par l'IA relançait les erreurs Gemini 429 et 503 avec un délai croissant. Or un 429 « quota exceeded » (et le 402 « crédits épuisés ») ne se règlent pas en attendant : la génération a tourné près de 5 minutes pour échouer à l'identique.

## 6. Les idées d'amélioration et ce que je ferais avec plus de temps
Avec plus de temps, dans l'ordre où je les ferais :

1. **Déduplication.** Regrouper les articles français / anglais dès l'ingestion plutôt qu'à la sélection.
2. **Acheter des crédits pour l'API LLM.** Gemini est parfois surchargé (503) : file d'attente avec relances, et repli sur un second modèle.
3. **Alertes.** Notifier quand une publication dépasse un seuil de score élevé (CAC 40, offre publique).
4. **Évaluer sur un jeu annoté.** Faire comme sur Twitter : une vérification par la communauté, avec un sondage de validation de la fiabilité de l'article.

## 7. Temps passé
- Début : 15:40. Fin de la rédaction du code et du déploiement : environ 18:40, avec une pause d'environ 15 min.
- **Temps réel : environ 2 h 45**
- Répartition approximative : exploration de l'API et ingestion, 40 min ; liste filtrable, 25 min ; score de sélection, 25 min ; génération des brèves, 40 min (dont du temps perdu sur le quota Gemini épuisé) ; vérification des chiffres, 25 min ; déploiement et README, le reste.
