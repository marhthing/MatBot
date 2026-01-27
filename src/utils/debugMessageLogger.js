// TEMPORARY: Debug logger for WhatsApp message structures
// Usage: import and call logIncoming(msg) or logOutgoing(chatId, text, options)

export function logIncoming(msg) {
  console.log('--- WhatsApp INCOMING MESSAGE STRUCTURE ---');
  console.dir(msg, { depth: 10, colors: true });
  
  // Also log key fields separately for clarity
  console.log('\n--- KEY FIELDS ---');
  console.log('remoteJid:', msg.key.remoteJid);
  console.log('remoteJidAlt:', msg.key.remoteJidAlt); // DM: PN when remoteJid is LID
  console.log('participant:', msg.key.participant);
  console.log('participantAlt:', msg.key.participantAlt); // Group: PN when participant is LID
  console.log('participantPn:', msg.key.participantPn); // Legacy field
  console.log('fromMe:', msg.key.fromMe);
  console.log('addressingMode:', msg.key.addressingMode);
  console.log('---\n');
}

export function logOutgoing(chatId, text, options) {
  // console.log('--- WhatsApp OUTGOING MESSAGE STRUCTURE ---');
  // console.dir({ chatId, text, options }, { depth: 10, colors: true });
}
