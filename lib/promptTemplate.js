// Hard-coded prompt template for the seedance-v2.0-i2v batch generations.
// Duration, aspect_ratio, and quality are intentionally NOT in the prompt —
// they're separate fields in the MuAPI request body.
//
// Inputs:
//   trainer  — { name, csvLabel, ... } from the trainers table
//   studio   — { name, csvLabel, ... } from the studios table (may be null)
//   job      — { practiceName, prompt (raw description),
//                startPosition, cameraAngle }
//
// Returns a single multi-line string ready to drop into payload.prompt.

export function renderPrompt({ trainer, studio, job }) {
  const trainerName = (trainer?.name || trainer?.csvLabel || 'the trainer').trim();
  const studioName = (studio?.name || studio?.csvLabel || 'the studio').trim();
  const practice = job?.practiceName?.trim() || 'the practice';
  const camera = job?.cameraAngle?.trim() || 'eye-level tripod shot';
  const startPosition = job?.startPosition?.trim() || 'a relaxed neutral standing position';
  const description = job?.prompt?.trim() || '';

  return [
    `Single continuous take of @${trainerName} performing ${practice} inside @${studioName}.`,
    `Camera: ${camera}, static tripod shot, no camera movement.`,
    `@${trainerName} starts in ${startPosition}.`,
    ``,
    `Step-by-step movement:`,
    description,
    ``,
    `Movement style:`,
    `- Controlled and instructional`,
    `- clearly demonstrates correct form`,
    `- no abrupt or unnatural motion`,
    ``,
    `Biomechanics constraints:`,
    `- correct joint alignment at all times`,
    `- natural range of motion (no overextension)`,
    `- stable base and grounded contact with floor`,
    `- balanced weight distribution`,
    `- spine remains neutral unless specified`,
    `Movement must follow real human biomechanics, no artificial motion.`,
    ``,
    `Identity constraints:`,
    `- @${trainerName} must remain 100% consistent (face, body, proportions)`,
    `- no identity drift`,
    ``,
    `Environment constraints:`,
    `- keep studio layout exactly unchanged`,
    `- maintain plant positions, lighting, textures`,
    `- yoga mat remains centered and stable`,
    ``,
    `Lighting:`,
    `- soft natural daylight (from studio windows)`,
    `- stable shadows`,
    `- no flicker or exposure shifts`,
    ``,
    `Clothing:`,
    `- off-white / beige relaxed yoga wear`,
    `- natural fabric, no logos`,
    ``,
    `Expression:`,
    `- calm, focused, slightly warm and approachable`,
    ``,
    `Video style:`,
    `- real-world recording`,
    `- no stylization`,
    `- no cinematic effects`,
    `- no artificial smoothing`,
    ``,
    `Constraints:`,
    `- no camera movement`,
    `- no cuts or transitions`,
    `- no limb warping`,
    `- no pose distortion`,
    `- no speed ramping`,
    `- no background changes`,
    `- no added props`,
  ].join('\n');
}
