// Conditions d'utilisation de TUVOA Studio (page publique, demandée par TikTok et Meta).
export const metadata = { title: "Conditions d'utilisation · TUVOA Studio" };

export default function CGU() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px 80px", lineHeight: 1.65, fontSize: 16 }}>
      <h1 style={{ fontSize: 28 }}>Conditions d'utilisation de TUVOA Studio</h1>
      <p style={{ color: "#667" }}>Dernière mise à jour : 5 novembre 2026</p>

      <h2>1. Objet</h2>
      <p>TUVOA Studio est l'outil de publication interne de TUVOA Tech Media, média burkinabè consacré à l'actualité technologique. Il permet à l'équipe éditoriale de TUVOA de préparer, programmer et publier ses propres contenus (articles, visuels, citations, photos) sur les comptes officiels de TUVOA : site web, Facebook, LinkedIn et TikTok.</p>

      <h2>2. Utilisateurs</h2>
      <p>L'accès à TUVOA Studio est réservé aux membres de l'équipe TUVOA, au moyen d'un mot de passe. L'outil n'est pas ouvert au public et ne permet pas à des tiers de créer un compte.</p>

      <h2>3. Comptes de réseaux sociaux reliés</h2>
      <p>TUVOA Studio se connecte uniquement aux comptes appartenant à TUVOA, avec l'autorisation explicite de leur titulaire, via les interfaces officielles de chaque plateforme (par exemple Login Kit et Content Posting API de TikTok). Ces autorisations peuvent être retirées à tout moment depuis les paramètres de la plateforme concernée.</p>

      <h2>4. Contenus publiés</h2>
      <p>Les contenus publiés via TUVOA Studio sont produits et validés par TUVOA Tech Media, qui en assume la responsabilité éditoriale. TUVOA s'engage à respecter les règles de chaque plateforme, les droits d'auteur et le droit à l'image, et à citer ses sources.</p>

      <h2>5. Disponibilité</h2>
      <p>TUVOA Studio est fourni en l'état, pour un usage interne. TUVOA peut le modifier, le suspendre ou l'arrêter à tout moment.</p>

      <h2>6. Contact</h2>
      <p>Pour toute question : TUVOA Tech Media, <a href="https://www.tuvoa.media">www.tuvoa.media</a>.</p>

      <p style={{ marginTop: 32 }}><a href="/confidentialite">Politique de confidentialité</a></p>
    </main>
  );
}
