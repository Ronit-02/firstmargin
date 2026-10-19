const labels = {
  regular: 'Regular',
  premium: 'Premium',
  'exclusive-writer': 'Exclusive writer',
  moderator: 'Moderator',
  admin: 'Admin',
}

export default function roleLabel(role) {
  return labels[role] || null
}
