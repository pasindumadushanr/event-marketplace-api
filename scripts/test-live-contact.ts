async function testContact() {
  try {
    const res = await fetch('https://event-marketplace-api.onrender.com/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: "Test User",
        email: "pasindumadushanr01@gmail.com",
        subject: "Test Subject",
        message: "This is a test message from Antigravity."
      })
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (error) {
    console.error('Error:', error);
  }
}
testContact();
