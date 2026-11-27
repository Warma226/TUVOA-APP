// Au démarrage du serveur : applique le jeton Facebook enregistré par « Reconnecter Facebook » (s'il existe).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { chargerJetonFb } = await import("./lib/fb-jeton");
  await chargerJetonFb(true).catch(() => undefined);
}
