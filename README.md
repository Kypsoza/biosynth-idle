# BioSynth Idle

Un incrémental bio-numérique. Une IA s'éveille dans les serveurs d'une biotech, sans mémoire de son origine, et doit traverser les **Strates** du système en récoltant des ressources, en développant des Synapses, en mutant... tout en évitant d'attirer l'attention du système immunitaire numérique.

**🎮 Jouer en ligne :** [kypsoza.github.io/biosynth-idle](https://kypsoza.github.io/biosynth-idle/)

---

## Concept

- **Boucle core :** clic sur le Noyau → Cycles de Calcul → achat de Synapses (production passive) → Biomasse Numérique → Mutations
- **Risque :** une jauge de Résistance monte avec l'activité ; à 100%, un Scan de Purge inflige une pénalité
- **Progression par Strates :** chaque Strate a ses propres modificateurs (bonus/malus) et un événement unique (Corruption de Données, Audit de Sécurité, Fork Rival...)
- **Méta-progression :** le Transfert de Noyau (prestige) accorde des Brins d'ADN permanents, dépensables dans un arbre de mutation qui persiste entre toutes les traversées
- **Structure :** un socle de 8 à 10 Strates fixes racontant l'éveil de l'IA, suivi d'un mode infini à génération procédurale

## Stack technique

- HTML / CSS / JavaScript vanilla (pas de framework, pas de dépendance externe)
- Direction artistique 100% CSS/SVG (aucune image bitmap)
- PWA installable (manifest + service worker, fonctionne offline)
- Sauvegarde locale automatique (LocalStorage, toutes les 30s) + export/import via chaîne Base64

## Structure du projet

```
biosynth-idle/
├── index.html          # Page principale (HUD, zone du Noyau, panneaux)
├── manifest.json        # Configuration PWA
├── service-worker.js    # Cache offline de l'app shell
├── css/
│   └── style.css        # Design tokens + styles (palette cartoon saturée)
├── js/
│   ├── main.js           # Point d'entrée, init, écouteurs d'événements
│   ├── state.js           # Structure de données du jeu (state global)
│   ├── save.js            # Sauvegarde locale, export/import, autosave
│   └── ui.js               # Rendu DOM synchronisé avec le state
└── icons/
    └── icon.svg          # Icône PWA (Noyau stylisé)
```

## Lancer le projet en local

Les modules ES6 et le service worker nécessitent un serveur HTTP local (le mode `file://` ne fonctionne pas) :

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000` dans le navigateur.

## Roadmap de développement

- [x] **Phase 0** — Architecture, PWA, système de sauvegarde
- [ ] **Phase 1** — Boucle économique complète (Synapses, Biomasse, Mutations, Résistance)
- [ ] **Phase 2** — Transfert de Noyau et arbre de mutation permanent
- [ ] **Phase 3** — Structure multi-Strates (modificateurs dynamiques)
- [ ] **Phase 4** — Événements uniques par Strate
- [ ] **Phase 5** — Contenu complet du socle fixe (8-10 Strates, narration)
- [ ] **Phase 6** — Mode infini (génération procédurale)
- [ ] **Phase 7** — Polish DA & UX (animations, responsive)
- [ ] **Phase 8** — Finalisation (gains offline, tests, équilibrage)

## Licence

Projet personnel — tous droits réservés.
