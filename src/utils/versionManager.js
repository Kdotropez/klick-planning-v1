// Système de gestion de version pour forcer le vidage du cache
import { version } from '../../package.json';

const VERSION_KEY = 'app_version';
const VERSION_HIGHLIGHTS_SEEN_KEY = 'app_version_highlights_seen';

const VERSION_HIGHLIGHTS = {
  '3.10.49': [
    'Deverrouillage d urgence simplifie et securise.',
    'Mode contraste eleve activable pour ameliorer la lisibilite sur PC plus faibles.',
    'Historique Supabase integre avec restauration de versions (date, source, poste/utilisateur si disponible).',
    'Compteur de sauvegarde JSON automatique affiche en secondes et plus fiable visuellement.',
    'Masquage employe persistant jusqu a reactivation manuelle.'
  ],
  '3.10.50': [
    'Restauration Supabase au demarrage amelioree: affichage date, poste et utilisateur de la derniere sauvegarde.',
    'Bascule automatique vers l historique Supabase si la sauvegarde courante ne contient pas de metadonnees exploitables.',
    'Fermeture application renforcee: sauvegarde puis liberation du verrou avant fermeture de session.',
    'Recap employe reamenage: cartes par employe plus lisibles et actions essentielles regroupees sous le nom.',
    'Affichage des elements de recap adapte pour gagner de la place tout en gardant les donnees importantes accessibles.'
  ],
  '3.10.51': [
    'Masquage et reactivation des employes corriges par boutique, sans fuite entre boutiques.',
    'Filtrage strict des employes: seuls les employes reellement affectes a la boutique sont affiches.',
    'La version commune Supabase devient la source obligatoire au demarrage pour eviter les ecrasements.',
    'Popup Nouveautes passe en plein ecran pour une lecture confortable.',
    'Affichage des nouveautes/historique au lancement maintenu avec historique complet des versions.'
  ]
,
  '3.10.52': [
    'Mise a jour version 3.10.52.',
    'Historique a completer.'
  ],
  '3.10.53': [
    'Ajout du bouton "Journal d audit" dans le menu planning.',
    'Acces protege par code superviseur avant affichage du journal.',
    'Nouvel ecran lisible avec date, utilisateur, action, boutique et details.',
    'Trace locale des actions principales (connexion, restauration, sauvegarde manuelle, masquage/reactivation employe, fermeture session).'
  ],
  '3.10.54': [
    'Correction de la copie semaine vers semaine+1 (mapping des dates fiabilise en timezone locale).',
    'Correction de la copie des statuts journaliers (conge/maladie) lors du report a la semaine suivante.',
    'Stabilisation du Journal d audit (ordre des hooks React) et reduction des logs techniques bruyants.'
  ],
  '3.10.55': [
    'Correction de la copie des conges/maladies vers semaine+1 quand la semaine source est en cours de modification.',
    'La copie utilise maintenant les donnees en memoire de la semaine affichee (sans exiger une sauvegarde manuelle prealable).'
  ],
  '3.10.56': [
    'Correction des totaux heures (jours + employes) sur poste distant avec gestion timezone-safe.',
    'Uniformisation des calculs de dates de semaine via parseISO pour eviter les decalages de jour.'
  ],
  '3.10.57': [
    'Correction des faux totaux (heures employees/jours) quand des anciens formats de creneaux existent.',
    'Normalisation des valeurs de creneaux legacy (1, "1", "true") en booleens pour aligner affichage et calcul.'
  ],
  '3.10.58': [
    'Ajout d un export lisible des horaires employes en mode collectif ou individuel.',
    'Export texte hebdomadaire multi-boutiques avec plages horaires consolidees, statuts (conge/maladie) et jours de repos.'
  ],
  '3.10.59': [
    'Ajout d un mode Inspection du travail avec affichage hebdomadaire par boutique.',
    'Mentions obligatoires par boutique sauvegardees localement + impression et export PDF dedies.'
  ],
  '3.10.60': [
    'Correction de la memorisation des mentions inspection par boutique (cles robustes id + nom normalise).',
    'Ajout des champs obligatoires complementaires: inspection du travail, medecine du travail, secours urgence, date/signature employeur.'
  ],
  '3.10.61': [
    'Mode inspection renforce: champs horaires collectifs, pause/coupure, date de publication et bloc legal d affichage date/signe.',
    'Mentions inspection enregistrees dans planningData (inspectionMetaByShop) pour inclusion automatique dans les sauvegardes JSON/Supabase.'
  ],
  '3.10.62': [
    'Fiche inspection: ajout de la date d entree editable par employe et affichage de la duree de contrat au jour d edition.',
    'Les dates d entree sont sauvegardees dans planningData (employes.dateEntree) pour inclusion complete dans les sauvegardes/restaurations.'
  ],
  '3.10.63': [
    'Fiche inspection: ajout des colonnes date de sortie et heures contractuelles (modifiables, hausse/baisse).',
    'Calcul de duree de contrat au jour d edition avec prise en compte de la date de sortie, et sauvegarde dans planningData (dateSortie/contratHours).'
  ],
  '3.10.64': [
    'Export horaires lisibles (TXT et PDF): total des heures sur la semaine exportee par employe, plus cumul mensuel detaille par boutique (mois de la semaine affichee).',
    'Copier-coller de planning: prise en compte des statuts conge/maladie, fusion avec le planning en memoire pour la semaine source = semaine affichee.',
    'Detection des cellules reellement renseignees (plus de fausses alertes a cause des grilles vides), reprise du presse-papiers apres rechargement.',
    'Copie semaine vers semaine suivante: meme logique pour l avertissement d ecrasement (conges et statuts comptes comme des donnees presentes).'
  ],
  '3.10.65': [
    'Inspection du travail: identite et SIRET imposes (Cannes separe), activite 4725Z, memorisation des autres champs, type de contrat et heures, sans date de sortie, alignement des donnees sur toutes les boutiques pour un meme employe.',
    'Export horaires lisibles: telechargement en chaine d un PDF ou TXT par employe, tableau du cumul mensuel en PDF, page synthese semaine et mois sur l export collectif en un seul PDF.'
  ],
  '3.10.66': [
    'Recap semaine (tous): affichage des heures par jour et total hebdomadaire par employe (Multi-boutiques), PDF enrichi en consequence.'
  ],
  '3.10.67': [
    'Pilotage semaine: module unique (ex-vue globale + ex-dashboard) avec KPI, couverture par jour, absences, selecteurs boutique/mois/semaine et impression du planning. Vue globale / dashboard separes retires du menu.'
  ],
  '3.10.68': [
    'Recap semaine « qui / ou » : perimetre par boutique, exclusion des employes masques et non affectes, export coherents.',
    'Vue par employe ou par boutique (1re colonne boutique, employes par jour) avec PDF decide.',
    'Ouverture du recap sur la boutique courante; export horaires lisible et cumul mensuel filtres sur les memes regles d eligibilite.'
  ],
  '3.10.69': [
    'Pilotage de la semaine: detail en pop-up en cliquant sur les cartes (synthese), chaque jour (onglet Jour par jour) ou chaque ligne (Absences) — tableaux, listes d employes, dates de conges par semaine / mois.'
  ],
  '3.10.70': [
    'Pilotage de la semaine: menu Employe pour filtrer toute l equipe ou une personne (KPI, jour par jour, absences, details modale).',
    'Impression du planning hebdo depuis le pilotage: une seule feuille si un employe est selectionne.',
    'Sous-titre et rappel de perimetre quand un employe est cible; retour automatique a Tous si l employe n est plus dans la boutique affichee.'
  ],
  '3.10.71': [
    'Creneaux a durees variables: heures calculees selon la duree reelle de chaque colonne (ecart avec la suivante + fin journee endTime).',
    'Marche ambulant: prereglage 5h-17h, quarts d heure sauf tranches d 1 h entre 8h et 13h; bouton dans la configuration des tranches.',
    'Fusion config boutique: conservation des timeSlots explicites (grilles mixtes), sans regeneration uniforme automatique.',
    'Recaps, exports, impressions, sauvegardes et vues globales alignes sur ces durees.'
  ],
  '3.10.72': [
    'ShopConfig: prereglage marche ambulant (meme grille mixte que les tranches horaires), conservation mixedSlotProfile.',
    'updateShopConfig et resync au chargement planning: grille canonique marche + migration des coches si ancienne grille uniforme (boutiques marche ambulant).',
    'Tableau drag-and-drop: colonnes creneaux uniformes; colgroup en pourcentages pour largeur ecran sans scroll horizontal.',
    'PlanningDisplay: overflow horizontal coupe, vertical conserve; conteneurs planning-content / left / right avec minWidth 0.'
  ],
  '3.10.73': [
    'Heures journalieres: debut = ligne DE du premier creneau cochu, fin = ligne A du dernier creneau cochu (toutes boutiques, grilles a durees variables).',
    'calculateEmployeeDailyHours refactorise (overlap avec affichage tableau); plus de log console par calcul.'
  ],
  '3.10.74': [
    'Totaux journaliers et heures sur la ligne employe au format horaire (h et minutes), coherent avec une grille au quart d heure — plus de 8,8 h pour 8 h 45.'
  ],
  '3.10.76': [
    'Affichage Inspection du travail: selection des employes a faire figurer par boutique, memorisee avec les mentions.',
    'Affichage Inspection du travail: remplacement de Repos par Exterieur quand l employe travaille dans une autre boutique le meme jour.',
    'Fiche inspection: champs longs repliables/lisibles, colonne Heures semaine, PDF et impression restructures.',
    'Convention collective par defaut corrigee: Commerces de gros - IDCC 2216.',
    'Planning: resynchronisation initiale des drag & drop lorsque les donnees sauvegardees arrivent apres le premier rendu.'
  ],
  '3.10.77': [
    'Planning: correction de l ouverture initiale des horaires drag & drop quand la semaine courante etait initialisee avec la date du jour au lieu du lundi.',
    'Planning: normalisation systematique de la cle semaine au lundi pour charger, afficher et sauvegarder les semaines existantes.',
    'Selection semaine: reprise automatique d une ancienne date non-lundi vers la semaine canonique correspondante.'
  ],
  '3.10.78': [
    'Planning boutiques semaine: presentation par boutique par defaut pour voir qui travaille, quel jour et sur quels horaires.',
    'Conges et maladies mis en evidence dans les cases du tableau, avec cartes de synthese en haut de fenetre.',
    'Ajout de l impression directe du tableau semaine en plus de l export PDF, avec une mise en page paysage lisible.'
  ],
  '3.10.79': [
    'Planning boutiques semaine: ajout d un choix Semaine / Mois dans la fenetre de recapitulatif.',
    'Vue globale multi-boutiques par employe: chaque case indique la boutique et les horaires travailles.',
    'Vue Mois global: lecture mensuelle multi-boutiques avec impression et PDF, en complement de la vue semaine.'
  ],
  '3.10.80': [
    'Planning boutiques semaine: refonte du PDF par boutique pour une lecture plus proche de l apercu ecran.',
    'PDF par boutique: separation claire entre employes presents, conges/maladies et total du jour.',
    'Ajout d un en-tete, de cartes de synthese et de sections boutique pour eviter le tableau compact trop melange.'
  ],
  '3.10.81': [
    'Planning: verrouillage automatique de toutes les dates anterieures au jour actuel.',
    'Deverrouillage ponctuel par code superviseur pour rendre les dates anterieures modifiables pendant la session.',
    'Ajout d un bouton de reverrouillage de session et blocage des actions de modification sur les dates verrouillees.',
    'Planning global multi-boutiques: PDF par employe rehabille avec en-tete, cartes de synthese et tableau plus proche de l apercu ecran.'
  ],
  '3.10.82': [
    'Planning global multi-boutiques: l export PDF capture desormais le rendu ecran reel de la fenetre.',
    'PDF: conservation des cartes de synthese, couleurs, tableaux et presentation visuelle de l apercu.',
    'PDF: decoupage automatique sur plusieurs pages A4 paysage quand le tableau depasse une page.'
  ],
  '3.10.83': [
    'Planning: retablissement du verrouillage complet d une semaine des qu une semaine suivante a ete ouverte.',
    'Planning: conservation du verrouillage par date pour tous les jours anterieurs au jour actuel.',
    'Deverrouillage superviseur maintenu pour rendre une semaine passee modifiable uniquement pendant la session.'
  ],
  '3.10.84': [
    'Planning global multi-boutiques: adaptation du PDF capture pour tenir sur une seule feuille A4 paysage.',
    'PDF: reduction proportionnelle du rendu ecran avec centrage sur la page.',
    'PDF: suppression du decoupage automatique multi-pages pour respecter la contrainte d une feuille A4.'
  ],
  '3.10.85': [
    'Planning global multi-boutiques: capture PDF elargie a toute la largeur reelle du tableau.',
    'PDF A4: inclusion des colonnes hors ecran avant reduction proportionnelle sur une seule feuille.',
    'PDF: expansion des zones defilantes pendant la capture pour eviter un export tronque.'
  ],
  '3.10.86': [
    'Planning global multi-boutiques: fenetre de planning semaine redimensionnable a l ecran.',
    'Ajout de tailles minimale et maximale pour agrandir la vue sans sortir de l ecran.',
    'Indication visuelle dans l en-tete pour rappeler que la fenetre se redimensionne par le coin inferieur droit.'
  ],
  '3.10.87': [
    'Planning global multi-boutiques: remplacement du redimensionnement natif par une poignee dediee.',
    'Fenetre planning: redimensionnement stable en largeur et hauteur sans disparition hors ecran.',
    'Fenetre planning: prevention de la fermeture accidentelle pendant le redimensionnement.'
  ],
  '3.10.88': [
    'Planning global multi-boutiques: le redimensionnement augmente desormais surtout la zone visible du tableau.',
    'Fenetre planning: en-tete, filtres, cartes et pied restent fixes pour donner l espace gagne au contenu.',
    'Vue planning: ajout de contraintes flex pour afficher davantage de lignes quand la fenetre est agrandie.'
  ],
  '3.10.89': [
    'Demarrage: apres identification, ouverture directe du planning sur la semaine actuelle quand des donnees existent.',
    'Restauration locale ou Supabase: arrivee directe sur le planning de la semaine actuelle.',
    'Le menu semaine reste accessible uniquement via le retour volontaire a la selection de semaine.'
  ],
  '3.10.90': [
    'Planning: les cartes/recapitulatifs employes sont desormais masques par defaut a l ouverture.',
    'Le bouton Afficher permet de faire apparaitre les cartes employes a la demande.',
    'Aucun changement sur le statut reel des employes: le masquage concerne uniquement l affichage des cartes.'
  ],
  '3.10.91': [
    'Planning global multi-boutiques: correction de la fermeture accidentelle apres redimensionnement rapide.',
    'Fenetre planning: le clic de fond est ignore juste apres le lacher de la poignee de redimensionnement.',
    'Poignee de redimensionnement: blocage explicite du clic pour eviter le retour involontaire au menu.'
  ],
  '3.10.92': [
    'Planning global multi-boutiques: ajout du nombre d employes actifs dans les cartes de synthese.',
    'Employes actifs: comptage des employes visibles/non masques et affectes au perimetre affiche.',
    'Impression/PDF du planning semaine: inclusion du compteur d employes actifs dans le rendu capture.'
  ],
  '3.10.93': [
    'Planning global multi-boutiques: ajout d une page 2 au PDF avec les employes actifs de la periode.',
    'Page 2 PDF: tableau des employes actifs, boutiques concernees, cumul horaire et statut de planification.',
    'Recap PDF: ajout des compteurs employes actifs, employes au planning, cumul horaire, conges et maladie.'
  ],
  '3.10.94': [
    'Planning semaine: ajout d un bouton pour visualiser les employes actifs directement dans la fenetre.',
    'Employes actifs: affichage ecran des boutiques concernees, du cumul horaire et du statut de planification.',
    'Recap ecran: indication claire des employes actifs sans horaire sur la periode.'
  ],
  '3.10.95': [
    'Planning semaine: ajout du cumul sur le mois calendaire dans le tableau des employes actifs.',
    'Employes actifs: distinction entre cumul de la periode affichee et cumul du mois complet.',
    'PDF page 2: ajout de la colonne cumul mois calendaire dans le recapitulatif des employes actifs.'
  ],
  '3.10.96': [
    'Export Excel: distinction claire avec le recap mensuel d un employe (nouveau libelle bouton et modale).',
    'Export Excel global: mois par defaut aligne sur la semaine ouverte dans le planning.',
    'Fichier exporte: nom planning_detaille_mois_YYYY-MM pour identifier le mois couvert.'
  ],
  '3.10.97': [
    'Export Excel global: prise en compte des plannings sauvegardes localement pour correspondre au planning affiche.',
    'Export Excel: resolution renforcee des employes depuis les selections sauvegardees afin de retrouver les vrais noms.',
    'Export Excel: suppression des colonnes d employes sans donnees sur le mois et filtrage des identifiants techniques emp_.'
  ],
  '3.10.98': [
    'Export Excel global: restauration des employes multi-boutiques et des colonnes presentes avant le filtrage.',
    'Export Excel: conservation des identifiants techniques emp_ lorsqu ils portent encore des horaires reels.',
    'Export Excel: retrait du filtrage trop agressif qui masquait des boutiques et des employes.'
  ],
  '3.10.99': [
    'Export Excel global: recherche renforcee du vrai nom employe a partir des identifiants de planning emp_.',
    'Export Excel: prise en compte des selections employees sauvegardees meme lorsqu elles contiennent seulement des identifiants.',
    'Export Excel: recuperation des metadonnees employe dans les donnees locales JSON pour reafficher Angelique si l association existe.'
  ],
  '3.10.100': [
    'Export Excel global: transmission du contexte reel affiche (boutique, semaine, planning en memoire et employes connus par l ecran).',
    'Export Excel: arret de l exclusion des employes masques lorsque des horaires existent dans le planning.',
    'Export Excel: alignement renforce avec les donnees utilisees par le recap mensuel detaille.'
  ],
  '3.10.101': [
    'Export Excel employe: correction des journees multi-boutiques, toutes les boutiques du meme jour sont maintenant ecrites.',
    'Export Excel employe: totaux hebdomadaires et mensuels par boutique recalcules avec toutes les lignes du jour.',
    'Export Excel: correction de l ecart entre le recap mensuel ecran et la feuille Excel employe.'
  ],
  '3.10.102': [
    'Mode ecole: ouverture d une sauvegarde JSON en lecture seule sans remplacer le planning actif.',
    'Mode ecole: visualisation du contenu d une ancienne sauvegarde avec resume boutiques, employes, semaines et jours planifies.',
    'Mode ecole: export JSON ou Excel isole, sans melange avec les donnees actives du navigateur.'
  ],
  '3.10.103': [
    'Mode ecole: bouton d acces direct dans la barre de menu du planning.',
    'Mode ecole: accessible sans passer par l ecran de demarrage.',
    'Mode ecole: retour automatique au planning apres consultation.'
  ],
  '3.10.104': [
    'Mode ecole: visualisation des horaires par boutique avec le tableau planning semaine/mois.',
    'Mode ecole: selecteur de semaine et bouton Visualiser les horaires.',
    'Mode ecole: lecture isolee du fichier JSON sans melange avec le planning actif.'
  ],
  '3.10.105': [
    'Mode ecole: choix libre des dates a visualiser (semaine, mois ou plage personnalisee).',
    'Mode ecole: selecteurs de dates avec bornes deduites du fichier charge.',
    'Mode ecole: acces rapide par semaine avec donnees enregistrees.'
  ],
  '3.10.106': [
    'Planning: reorganisation ecran drag & drop avant les recaps, cartes employes compactes en bas.',
    'Planning: cumul hebdomadaire ajoute dans le tableau drag & drop (jour + semaine).',
    'Recap employes: heures semaine et cumul mois en cadres, conges et maladie en cartes par jour.',
    'Menu actions: affichage/masquage optionnel de la barre complete, preference memorisee.',
    'Recap employes affiche par defaut a l ouverture du planning.'
  ],
  '3.10.107': [
    'Planning: popup Cartographie presence boutique (grille jour x heure).',
    'Cartographie: employes presents simultanement par creneau, code couleur selon effectif.',
    'Cartographie: filtre chevauchements, vue semaine ou jour affiche, conges/maladies en pied.',
    'Acces direct sous les jours du planning et depuis le menu actions.'
  ],
  '3.10.108': [
    'Cartographie presence: noms uniquement, sans compteur 1 pers / 2 pers.',
    'Cartographie: en-tete des jours fige lors du scroll des heures.',
    'Cartographie: couleur pastel distincte par jour.'
  ],
  '3.10.109': [
    'Planning: boutons SAUVE SUPABASE et Fermer toujours visibles (menu masque ou non).',
    'Barre actions epinglee en haut lors du scroll du planning.'
  ],
  '3.10.110': [
    'Recap hebdo employe (cartes): correction heures effectives et total semaine a 0 h.',
    'Recap hebdo: calcul multi-boutiques avec config horaire de chaque boutique.'
  ],
  '3.10.111': [
    'Restauration historique Supabase: correction erreur firstShop is not defined.',
    'Audit: boutique correctement journalisee apres restauration historique.'
  ],
  '3.10.112': [
    'Planning boutiques semaine: mode plage personnalisee (du/au) en plus semaine et mois.',
    'Planning boutiques semaine: bouton toujours visible dans la barre actions epinglee.'
  ],
  '3.10.113': [
    'Planning boutiques semaine: plage > 7 jours decoupee en tableaux semaine par semaine.',
    'Sous-total hebdomadaire par bloc; total periode sur le dernier tableau.',
    'Impression/PDF: meme decoupage par semaine que l ecran.'
  ],
  '3.10.114': [
    'Planning boutiques semaine: mode mois decoupe en tableaux semaine par semaine.',
    'Meme presentation que la plage personnalisee: sous-total semaine et total mois.'
  ],
  '3.10.115': [
    'Gestion acces: droits par utilisateur (boutiques + fonctions).',
    'Modale utilisateurs: bouton Droits pour configurer acces.',
    'Filtres appliques a la connexion (boutiques, menu, edition planning).'
  ],
  '3.10.116': [
    'Exports Excel/PDF limites aux boutiques autorisees de l utilisateur.',
    'Vues multi-boutiques et horaires lisibles alignes sur les droits boutique.'
  ],
  '3.10.117': [
    'Planning: barre menu actions affichee par defaut a l ouverture.'
  ],
  '3.10.118': [
    'Fix saveWeekPlanning: fusion avec semaine existante au lieu d ecraser tout le planning.'
  ],
  '3.10.119': [
    'Restauration ciblee depuis historique Supabase: une boutique + une semaine sans ecraser le reste.',
    'Bouton RESTAURATION CIBLEE dans le menu planning.'
  ],
  '3.10.120': [
    'Fix restauration ciblee: base Supabase complete obligatoire avant fusion.',
    'Blocage si perte de boutiques ou semaines detectee avant enregistrement.'
  ],
  '3.10.121': [
    'Recherche historique par boutique + semaine avec jours et employes par sauvegarde.',
    'Bouton CHERCHER HISTORIQUE pour previsualiser avant restauration.'
  ],
  '3.10.122': [
    'Historique: version ACTUELLE Supabase incluse dans la recherche (la plus recente).',
    'Calendrier des sauvegardes globales et liste historique elargie a 50 entrees.'
  ],
  '3.10.123': [
    'Recherche restauration inclut les lignes Supabase boutique/semaine (SAUVE SUPABASE).',
    'Inventaire semaines par boutique et cles semaine alternatives.'
  ],
  '3.10.124': [
    'Limites historique augmentees (200 snapshots, 300 lignes boutique).',
    'Diagnostic Supabase: date reelle derniere ecriture en base affichee dans Chercher historique.'
  ],
  '3.10.125': [
    'Fix historique Supabase vide: liste metadata legere sans charger 100 fichiers complets.',
    'HISTORIQUE SUPABASE reaffiche version actuelle + snapshots + lignes boutique.'
  ],
  '3.10.126': [
    'Recap employes: conges/maladies corriges pour employes multi-boutiques (Valou etc.).'
  ],
  '3.10.127': [
    'Fix race demarrage: localStorage plus ecrase par planning vide avant Supabase.',
    'Historique Supabase: auteur reaffiche, snapshots complets vs lignes boutique/semaine.',
    'Bouton Restaurer: message clarifie (backup_* vs JSON / historique).'
  ],
  '3.10.128': [
    'Historique Supabase: auteur/poste fiables (JSON _backupMeta + repli).',
    'Sauvegardes boutique/semaine: _backupMeta avec utilisateur et poste.'
  ],
  '3.10.129': [
    'Sauvegarde Supabase: fusion auto avec distant — boutiques manquantes preservees.',
    'Feedback sauvegarde: boutiques conservees depuis Supabase affichees.'
  ],
  '3.10.130': [
    'Copier semaine: historique annee passee + calendrier +/- 1 an + bouton Copier semaine.',
    'Recalage lundi-lundi entre semaine source et destination (ex. 2025 vers 2026).'
  ],
  '3.10.131': [
    'Fix copier-coller: donnees brutes, employes, navigation semaine destination, localStorage.'
  ],
  '3.10.132': [
    'Export horaires lisibles: option HTML mobile paysage (TXT/PDF/HTML).',
    'Planning boutique semaine: bouton HTML avec blocage portrait sur telephone.'
  ],
  '3.10.133': [
    'HTML paysage sur tous les exports PDF: recaps, matrix semaine, inspection, vue globale.',
    'Utilitaire partage exportElementHtmlAsLandscape + modales recaps employes.'
  ],
  '3.10.134': [
    'Menu: 3 boutons visibles Horaires TXT / PDF / HTML (fini le prompt option 3).',
    'Pilotage semaine: PDF + HTML direct; bouton HTML vert avant chaque PDF.'
  ],
  '3.10.135': [
    'Planning boutiques semaine: Exporter HTML = telechargement .html comme Exporter PDF.',
    'Export HTML: fichier telecharge + apercu paysage mobile.'
  ],
  '3.10.136': [
    'Conge/maladie: uniquement sur la boutique maitresse (export horaires TXT/PDF/HTML).',
    'Saisie conge: plus de propagation vers les boutiques de remplacement.',
    'Recap employes et matrice semaine: absences filtrees par boutique maitresse.'
  ],
  '3.10.137': [
    'Cartographie presence: export HTML semaine, HTML 7 jours et HTML jour affiche.',
    'Grille horaire journaliere par boutique, telechargement .html paysage mobile.'
  ],
  '3.10.138': [
    'Cartographie: vue equipe recommandee (carte/jour, prenom + horaires).',
    'Bloc « en boutique en meme temps » ; grille detaillee en option.'
  ],
  '3.10.139': [
    'HTML cartographie: duree (h), grille planning par jour, export boutique ou 1 fichier/employe.'
  ],
  '3.10.140': [
    'HTML cartographie: mode portrait OK, grille en 2 blocs matin/soir, scroll horizontal.'
  ],
  '3.10.141': [
    'Grille HTML mobile: prenoms compacts, colonnes serrees, plus de place perdue avant les creneaux.'
  ],
  '3.10.142': [
    'HTML cartographie: paysage obligatoire, grille pleine largeur avec tous les creneaux visibles.',
    'Modale cartographie ordinateur: tableau recapitulatif compact, grille horaire agrandie et lisible.'
  ],
  '3.10.143': [
    'HTML cartographie: cases vertes fiables (plus de blanc sur blanc), conflit CSS schedule-sheet corrige.'
  ],
  '3.10.144': [
    'HTML cartographie: recapitulatif heures de la semaine en bas de page (total par fille + total equipe).'
  ],
  '3.10.145': [
    'HTML cartographie: recap horaire jour par jour visible en bas, export employe sans les autres filles.'
  ],
  '3.10.146': [
    'Deverrouillage superviseur: toutes les semaines passees en une fois pour la session.',
    'Noms employes harmonises entre boutiques et sauvegarde locale immediate au renommage.'
  ],
  '3.10.147': [
    'Noms employes: affichage boutique aligne sur le nom canonique (ex. VALOU sur Port Grimaud).',
    'Sync automatique des noms divergents entre boutiques au chargement du planning.'
  ],
  '3.10.148': [
    'Bouton Renommer de retour dans le recap employes sous le planning.'
  ],
  '3.10.149': [
    'Renommage: sauvegarde Supabase automatique + noms canoniques non ecrases par Port Grimaud.',
    'Chargement Supabase: harmonisation des noms employes entre boutiques.'
  ],
  '3.10.150': [
    'Renommage: corrige VALEUR vers VALOU quand l ecran affichait deja le bon nom (noms stockes vs affiches).'
  ],
  '3.10.151': [
    'Securite sauvegarde: ne plus ecraser des semaines avec horaires par une semaine locale vide.'
  ],
  '3.10.152': [
    'Historique: 300 snapshots + bouton ARCHIVES SAUVE SUPABASE pour retrouver les sauvegardes anciennes par boutique.'
  ],
  '3.10.153': [
    'Bouton Restaurer JSON: ouvre le fichier .json (plus bouton inerte) + alertes de confirmation.'
  ],
  '3.10.154': [
    'Demarrage: repli local si Supabase KO; JSON importe prioritaire jusqu a SAUVE SUPABASE.',
    'Fix semaine/drag-drop; employes filtres strictement par boutique.'
  ],
  '3.10.155': [
    'CSP Vercel: autorise Supabase + vercel.live; connexion possible en mode hors ligne si Supabase CORS/reseau.'
  ],
  '3.10.156': [
    'Demarrage: timeout Supabase 10s — plus de blocage infini sur « Chargement des donnees en cours ».'
  ],
  '3.10.157': [
    'Connexion mode hors ligne: verrou local si Supabase KO — le programme s ouvre sans attendre Supabase.'
  ],
  '3.10.158': [
    'Fix blocage connexion: timeout codes Supabase, ecran demarrage direct, codes Nicolas/Maxime locaux.'
  ],
  '3.10.159': [
    'Fusion boutique depuis JSON: recuperer Sainte-Maxime sans effacer les autres boutiques.',
    'Alerte avant restauration Supabase complete si la sauvegarde contient moins de boutiques.'
  ],
  '3.10.160': [
    'Verrou global: tolerance reseau Supabase, plus de deconnexion brutale au SAUVE SUPABASE.'
  ],
  '3.10.161': [
    'SAUVE SUPABASE employes: fusion limitee a leur boutique — PG/STT/Cavalaire preserves.',
    'Sauvegarde annulee si le cloud Supabase est illisible (evite ecrasement des autres boutiques).'
  ],
  '3.10.162': [
    'Demarrage rapide: ouverture immediate avec copie locale, sync Supabase en arriere-plan.',
    'Requete Supabase allégée au boot; timeout reduit a 5 s si pas de copie locale.'
  ],
  '3.10.163': [
    'Recap hebdo employe: une ligne par boutique pour les journees multi-boutiques.',
    'Exports PDF/Excel du recap hebdo alignes sur le detail multi-boutiques.',
    'Nouveau rapport equipe HTML par boutique: qui travaille, horaires, heures jour/semaine.'
  ],
  '3.10.164': [
    'Rapport equipe HTML: cartographie Gantt, heatmap effectif/croisements, en-tetes lisibles.',
    'Alerte creneaux seul(e) en boutique dans le rapport HTML.'
  ]
};

const parseSemver = (v) => String(v || '0.0.0').split('.').map((n) => Number.parseInt(n, 10) || 0);
const compareSemver = (a, b) => {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  const max = Math.max(pa.length, pb.length);
  for (let i = 0; i < max; i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const showLargeVersionHighlightsModal = ({ currentVersion, newChangesText, fullHistoryText }) => {
  const existing = document.getElementById('version-highlights-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'version-highlights-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '99999';
  overlay.style.background = 'rgba(0,0,0,0.55)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '0';

  const modal = document.createElement('div');
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.background = '#ffffff';
  modal.style.borderRadius = '0';
  modal.style.boxShadow = 'none';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.overflow = 'hidden';
  modal.style.border = 'none';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.padding = '14px 18px';
  header.style.background = 'linear-gradient(90deg, #1e88e5 0%, #1565c0 100%)';
  header.style.color = '#ffffff';
  header.innerHTML = `
    <div style="font-size:18px;font-weight:700;letter-spacing:.3px;">
      Nouveautes et historique des modifications (v${escapeHtml(currentVersion)})
    </div>
    <button id="version-highlights-close-btn" style="background:#ffffff;color:#1565c0;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700;">
      Fermer
    </button>
  `;

  const body = document.createElement('div');
  body.style.padding = '16px 18px';
  body.style.overflow = 'auto';
  body.style.whiteSpace = 'pre-wrap';
  body.style.fontSize = '14px';
  body.style.lineHeight = '1.5';
  body.style.color = '#1f2937';
  body.textContent =
    `Nouveautes depuis votre derniere version:\n\n${newChangesText}\n\n` +
    `----------------------------------------\n` +
    `Historique complet jusqu'a v${currentVersion}:\n\n${fullHistoryText}`;

  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  const closeBtn = header.querySelector('#version-highlights-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', close);
};

/**
 * Vérifie si la version de l'application a changé
 * Si oui, vide le localStorage (sauf l'utilisateur) et force un rechargement
 */
export const checkVersion = () => {
  try {
    const currentVersion = version;
    const storedVersion = localStorage.getItem(VERSION_KEY);
    
    console.log('🔍 Vérification de version:', {
      currentVersion,
      storedVersion,
      hasChanged: storedVersion !== currentVersion
    });
    
    // Si la version a changé
    if (storedVersion && storedVersion !== currentVersion) {
      console.log('🔄 NOUVELLE VERSION DÉTECTÉE !');
      console.log(`   Ancienne: ${storedVersion}`);
      console.log(`   Nouvelle: ${currentVersion}`);
      console.log('🧹 Nettoyage du cache et localStorage...');
      
      // Sauvegarder les données importantes avant le clear
      const currentUser = localStorage.getItem('current_user');
      const userId = localStorage.getItem('user_id');
      
      // Vider TOUT le localStorage
      localStorage.clear();
      
      // Restaurer uniquement l'utilisateur
      if (currentUser) localStorage.setItem('current_user', currentUser);
      if (userId) localStorage.setItem('user_id', userId);
      
      // Enregistrer la nouvelle version
      localStorage.setItem(VERSION_KEY, currentVersion);
      
      // Afficher un message à l'utilisateur
      alert(
        `🎉 Nouvelle version installée !\n\n` +
        `Version ${currentVersion}\n\n` +
        `Le cache a été vidé pour garantir le bon fonctionnement.\n` +
        `La page va se recharger automatiquement.`
      );
      
      // Forcer le rechargement complet de la page (sans cache)
      window.location.reload(true);
      
      return true; // Version a changé
    }
    
    // Si c'est la première visite (pas de version stockée)
    if (!storedVersion) {
      console.log('🆕 Première visite - Enregistrement de la version:', currentVersion);
      localStorage.setItem(VERSION_KEY, currentVersion);
    }
    
    return false; // Version identique
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de version:', error);
    return false;
  }
};

/**
 * Obtient la version actuelle de l'application
 */
export const getAppVersion = () => {
  return version;
};

/**
 * Force la mise à jour manuelle (pour debug)
 */
export const forceVersionUpdate = () => {
  console.log('🔧 Forçage de la mise à jour de version...');
  localStorage.removeItem(VERSION_KEY);
  checkVersion();
};

/**
 * Affiche les informations de version dans la console
 */
export const logVersionInfo = () => {
  const currentVersion = version;
  const storedVersion = localStorage.getItem(VERSION_KEY);
  
  console.log('%c📦 VERSION DE L\'APPLICATION', 'font-size: 16px; font-weight: bold; color: #1e88e5;');
  console.log(`   Version actuelle: ${currentVersion}`);
  console.log(`   Version en cache: ${storedVersion || 'Aucune'}`);
  console.log(`   Status: ${storedVersion === currentVersion ? '✅ À jour' : '⚠️ Mise à jour nécessaire'}`);
};

export const showVersionHighlightsOnce = () => {
  try {
    const currentVersion = version;
    const seenVersion = localStorage.getItem(VERSION_HIGHLIGHTS_SEEN_KEY);

    const versionsUpToCurrent = Object.keys(VERSION_HIGHLIGHTS)
      .filter((v) => compareSemver(v, currentVersion) <= 0)
      .sort(compareSemver);

    const versionsToShow = versionsUpToCurrent
      .filter((v) => !seenVersion || compareSemver(v, seenVersion) > 0)

    const shouldShow = window.confirm(
      `🆕 Informations version (v${currentVersion}).\n\n` +
      `Souhaitez-vous voir les dernieres modifications et l'historique des versions au lancement ?`
    );

    if (shouldShow) {
      const newChangesText = versionsToShow.length > 0
        ? versionsToShow
            .map((v) => {
              const items = VERSION_HIGHLIGHTS[v] || [];
              return `Version ${v}\n${items.map((item, idx) => `  ${idx + 1}. ${item}`).join('\n')}`;
            })
            .join('\n\n')
        : 'Aucune nouvelle modification depuis votre derniere version.';

      const fullHistoryText = versionsUpToCurrent
        .map((v) => {
          const items = VERSION_HIGHLIGHTS[v] || [];
          return `Version ${v}\n${items.map((item, idx) => `  ${idx + 1}. ${item}`).join('\n')}`;
        })
        .join('\n\n');

      showLargeVersionHighlightsModal({
        currentVersion,
        newChangesText,
        fullHistoryText
      });
    }

    localStorage.setItem(VERSION_HIGHLIGHTS_SEEN_KEY, currentVersion);
  } catch (error) {
    console.error('❌ Erreur affichage nouveautes version:', error);
  }
};

