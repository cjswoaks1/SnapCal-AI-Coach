const API_KEY = "AIzaSyDZVAlyt1G9LDFUqLQi3CMVQkhJ-HmxkYU";
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
const payload = {
    contents: [{ role: "user", parts: [{ text: "hello" }] }]
};

fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
})
    .then(res => res.json())
    .then(data => console.log(JSON.stringify(data, null, 2)))
    .catch(err => console.error(err));
