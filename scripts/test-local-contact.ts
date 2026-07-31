async function testLocalContact() {
  try {
    const res = await fetch('http://localhost:3001/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: "Local Test User",
        email: "pasindumadushanr01@gmail.com",
        subject: "Local Test Subject",
        message: "This is a test message from local."
      })
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (error) {
    console.error('Error:', error);
  }
}
testLocalContact();
