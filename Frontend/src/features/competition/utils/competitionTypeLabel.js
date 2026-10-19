export default function competitionTypeLabel(competition) {
  if (competition.competitionType === 'reader_choice') return 'Readers’ Choice'
  if (competition.competitionType === 'collective_choice') return 'Collective Choice'
  if (competition.votingMode === 'readers') return 'Readers’ Choice'
  if (competition.votingMode === 'hybrid') return 'Collective Choice'
  if (competition.votingMode === 'judges') return 'Judges'
  return competition.competitionType || 'Competition'
}
