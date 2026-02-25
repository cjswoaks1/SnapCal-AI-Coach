import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// 🔥 제미나이(눈 담당 AI) 연동을 위한 키 설정
const GEMINI_API_KEY = "AIzaSyDZVAlyt1G9LDFUqLQi3CMVQkhJ-HmxkYU";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// TODO: Replace with your app's Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyDVnmPeMLeLKuvgnTXKVqLx1FwnKlrBECk",
    authDomain: "snapcal-ai-app-777.firebaseapp.com",
    projectId: "snapcal-ai-app-777",
    storageBucket: "snapcal-ai-app-777.firebasestorage.app",
    messagingSenderId: "278335201877",
    appId: "1:278335201877:web:13774f865dd873577e6adc"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM 요소
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userProfile = document.getElementById('user-profile');
const userNameDisplay = document.getElementById('user-name');

const tabBtns = document.querySelectorAll('.tab-btn');
const viewSections = document.querySelectorAll('.view-section');

const analyzeBtn = document.getElementById('analyze-btn');
const foodPreview = document.getElementById('food-preview');
const cameraOverlay = document.getElementById('camera-overlay');
const foodImageInput = document.getElementById('food-image-input');
const aiMarkers = document.getElementById('ai-markers');
const resultCard = document.getElementById('result-card');
const aiCoachingBox = document.getElementById('ai-coaching-box');
const aiCoachingMessage = document.getElementById('ai-coaching-message');

const saveMealBtn = document.getElementById('save-meal-btn');
const mealHistoryList = document.getElementById('meal-history-list');

// 전역 변수 (현재 스캔된 데이터)
let currentScanData = null;
let currentUser = null;
let uploadedMimeType = "image/jpeg";
let uploadedBase64 = null;

// --- 안티그래비티 기반(NotebookLM) AI 코칭 로직 (비만 치료 및 식단 관리 가이드) ---
function generateCoachingMessage(data) {
    const totalMacros = data.protein + data.carbs + data.fat;
    const proteinRatio = data.protein / totalMacros;
    const carbsRatio = data.carbs / totalMacros;

    // NotebookLM 요약 원칙에 따른 조건부 피드백 생성
    const messages = [
        "오늘도 기록하셨네요! 매일 식단을 기록하는 사람은 감량 효과가 2배 더 높답니다. 조급해하지 말고 6개월 간 5% 감량을 목표로 해보세요!"
    ];

    if (data.calories > 800) {
        messages.push("같은 100kcal라도 채소와 통곡물은 부피가 훨씬 큽니다. 칼로리가 높다면 수분과 식이섬유가 많은 식품으로 대체해 포만감을 높여보세요.");
    }

    if (proteinRatio < 0.25) {
        messages.push("단백질 섭취량이 부족해요! 단백질은 식탐을 줄여주고 다이어트 중 근육을 지켜줍니다. 닭가슴살뿐만 아니라 렌틸콩, 두부 같은 식물성 단백질도 함께 드시면 금상첨화입니다.");
    } else {
        messages.push("훌륭한 단백질 섭취입니다! 충분한 단백질은 포만감을 늘려 자발적인 식사량 감소로 이어집니다.");
    }

    if (carbsRatio > 0.5) {
        messages.push("탄수화물 비율이 다소 높습니다. 흰 빵이나 쌀밥 대신 소화가 천천히 되는 현미, 귀리로 바꾸면 인슐린 분비가 줄어 살이 덜 찝니다.");
    }

    messages.push("식사하실 때는 채소(식이섬유) -> 단백질 -> 탄수화물 순서(거꾸로 식사법)로 드시면 지방 축적 억제에 아주 유리합니다.");

    // 랜덤으로 1~2개의 핵심 조언만 노출
    const shuffled = messages.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 2).join('<br><br>💡 ');
}
// -------------------------------------------------------------------------

// --- 1. 탭 네비게이션 처리 ---

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // 활성화 상태 토글
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 뷰 전환
        const targetId = btn.dataset.target;
        viewSections.forEach(section => {
            if (section.id === targetId) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        });

        // 히스토리 탭 클릭 시 데이터 로드
        if (targetId === 'history-view') {
            loadMonthlyHistory();
        }
    });
});

// --- 2. 인증 관리 (익명 로그인 데모) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginBtn.classList.add('hidden');
        userProfile.classList.remove('hidden');
        userNameDisplay.textContent = "회원님"; // 실제 앱에선 구글 로그인 등으로 이름 가져옴
        console.log("Logged in with uid:", user.uid);
    } else {
        currentUser = null;
        loginBtn.classList.remove('hidden');
        userProfile.classList.add('hidden');
    }
});

loginBtn.addEventListener('click', () => {
    // 테스트 앱이므로 클릭 시 익명 로그인으로 처리
    signInAnonymously(auth).catch(error => {
        console.error("Login failed:", error);
        alert("로그인에 실패했습니다.");
    });
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
    alert("로그아웃 되었습니다.");
    // UI 초기화
    mealHistoryList.innerHTML = '<p class="empty-state">로그인 후 식단 기록을 확인할 수 있습니다.</p>';
    document.getElementById('monthly-total-calories').textContent = '0';
    document.getElementById('meal-count').textContent = '0';
});


// --- 3. 스캐너 (이미지 업로드 및 진짜 비전 AI 분석) ---
foodImageInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        uploadedMimeType = file.type; // 파일 타입 저장
        const reader = new FileReader();
        reader.onload = function (e) {
            foodPreview.src = e.target.result;
            uploadedBase64 = e.target.result.split(',')[1]; // Base64 데이터 추출
            foodPreview.classList.remove('hidden');
            cameraOverlay.classList.add('hidden');
            analyzeBtn.disabled = false;

            // UI 초기화
            resultCard.classList.add('hidden');
            aiCoachingBox.classList.add('hidden');
            aiMarkers.classList.add('hidden');
        }
        reader.readAsDataURL(file);
    }
});

// '분석 시작' 버튼 클릭 (진짜 Gemini Vision AI 호출)
analyzeBtn.addEventListener('click', async () => {
    if (GEMINI_API_KEY === "여기에_API_키를_넣으세요") {
        alert("🚨 구글 Gemini API 키가 장착되지 않았습니다! (수정 필요)");
        return;
    }

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "AI가 사진을 보고 분석 중입니다... ⏳";

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `이 음식 사진을 분석해줘. 사진에 있는 주요 음식들을 모두 인식하고, 그 음식들의 1인분 총합 기준으로 대략적인 섭취 칼로리(kcal), 단백질(g), 탄수화물(g), 지방(g)을 추정해줘. 음식이름은 한국어로 써줘. 반드시 아래 JSON 형식으로만 대답하고 마크다운 문법(\`\`\`)은 쓰지마.
{
  "calories": 500,
  "protein": 35,
  "carbs": 40,
  "fat": 15,
  "items": ["음식 1", "음식 2"]
}`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: uploadedBase64, mimeType: uploadedMimeType } }
        ]);

        let responseText = result.response.text();
        // 혹시 모를 마크다운 백틱 치환
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const scanResult = JSON.parse(responseText);

        currentScanData = scanResult;

        analyzeBtn.textContent = "AI 분석 완료!";

        // AI가 찾아낸 아이템 개수에 맞게 사진 위에 마커표시!
        aiMarkers.innerHTML = '';
        if (scanResult.items && scanResult.items.length > 0) {
            scanResult.items.forEach((item, index) => {
                const marker = document.createElement('div');
                marker.className = 'marker';
                marker.style.top = (40 + (index * 15)) + '%';
                marker.style.left = (30 + (index % 2 === 0 ? -10 : 20)) + '%';
                marker.textContent = item;
                aiMarkers.appendChild(marker);
            });
        }
        aiMarkers.classList.remove('hidden');
        resultCard.classList.remove('hidden');

        // 결과 카드 업데이트
        document.getElementById('calc-calories').textContent = currentScanData.calories;
        document.getElementById('val-protein').textContent = currentScanData.protein + 'g';
        document.getElementById('val-carbs').textContent = currentScanData.carbs + 'g';
        document.getElementById('val-fat').textContent = currentScanData.fat + 'g';

        // 영양소 비율에 맞춘 게이지 애니메이션
        const totalMacros = currentScanData.protein + currentScanData.carbs + currentScanData.fat;
        setTimeout(() => {
            const pRatio = totalMacros > 0 ? (currentScanData.protein / totalMacros * 100) : 0;
            const cRatio = totalMacros > 0 ? (currentScanData.carbs / totalMacros * 100) : 0;
            const fRatio = totalMacros > 0 ? (currentScanData.fat / totalMacros * 100) : 0;

            document.querySelector('.protein-fill').style.width = pRatio + '%';
            document.querySelector('.carbs-fill').style.width = cRatio + '%';
            document.querySelector('.fat-fill').style.width = fRatio + '%';

            // NotebookLM 코칭 주입 (방금 만든 똑똑한 두뇌 연결)
            aiCoachingMessage.innerHTML = '💡 ' + generateCoachingMessage(currentScanData);
            aiCoachingBox.classList.remove('hidden');
        }, 100);

    } catch (error) {
        console.error("Vision AI Error:", error);
        alert("이미지 분석 중 에러가 발생했습니다. (API 키 오류 또는 일시적 서버 장애)");
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = "다시 사진 고르기";
    }
});

// --- 4. 파이어베이스 연동: 식단 기록 저장 ---
saveMealBtn.addEventListener('click', async () => {
    if (!currentUser) {
        alert("식단 기록은 로그인이 필요합니다. 상단의 '로그인' 버튼을 눌러주세요.");
        return;
    }

    if (!currentScanData) return;

    saveMealBtn.disabled = true;
    saveMealBtn.textContent = "저장 중...";

    try {
        const mealsRef = collection(db, "users", currentUser.uid, "meals");
        await addDoc(mealsRef, {
            ...currentScanData,
            timestamp: serverTimestamp() // 파이어베이스 서버의 현재 시간 기록
        });

        alert("식단이 성공적으로 저장되었습니다!\n월간 기록 탭에서 확인해보세요.");

        // 초기화
        resultCard.classList.add('hidden');
        aiCoachingBox.classList.add('hidden');
        aiMarkers.classList.add('hidden');
        foodPreview.classList.add('hidden');
        cameraOverlay.classList.remove('hidden');
        analyzeBtn.textContent = "AI 분석 시작하기";
        analyzeBtn.disabled = true;
        currentScanData = null;

    } catch (e) {
        console.error("Error adding document: ", e);
        alert("기록 저장 중 에러가 발생했습니다.");
    } finally {
        saveMealBtn.disabled = false;
        saveMealBtn.textContent = "이 식단 기록에 저장하기";
    }
});


// --- 5. 파이어베이스 연동: 식단 기록 불러오기 (이번 달) ---
async function loadMonthlyHistory() {
    if (!currentUser) {
        mealHistoryList.innerHTML = '<p class="empty-state">로그인 후 기록을 확인할 수 있습니다.</p>';
        return;
    }

    mealHistoryList.innerHTML = '<p class="empty-state">데이터를 불러오는 중입니다...</p>';

    try {
        // 이번 달 1일 0시 기준 시간 구하기
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const mealsRef = collection(db, "users", currentUser.uid, "meals");
        // 이번 달 데이터만 쿼리 (최신순)
        const q = query(mealsRef, where("timestamp", ">=", startOfMonth), orderBy("timestamp", "desc"));

        const querySnapshot = await getDocs(q);

        mealHistoryList.innerHTML = ''; // 내용 비우기
        let totalCalories = 0;
        let mealCount = 0;

        if (querySnapshot.empty) {
            mealHistoryList.innerHTML = '<p class="empty-state">아직 이번 달 기록이 없습니다.</p>';
        } else {
            querySnapshot.forEach((doc) => {
                const data = doc.data();

                // 이번 달 총 칼로리 누적 
                totalCalories += data.calories || 0;
                mealCount++;

                // 화면에 리스트 그리기
                const li = document.createElement('li');

                // 파이어베이스 Timestamp를 자바스크립트 Date로 변환
                const dateObj = data.timestamp ? data.timestamp.toDate() : new Date();
                const dateString = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 ${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

                li.innerHTML = `
                    <div class="meal-info">
                        <strong>🍴 ${data.items ? data.items.join(', ') : '알 수 없는 식단'}</strong>
                        <span class="meal-date">${dateString}</span>
                    </div>
                    <div class="meal-cal">
                        <strong style="color:var(--accent);">${data.calories} kcal</strong>
                    </div>
                `;
                mealHistoryList.appendChild(li);
            });
        }

        // 대시보드 업데이트
        document.getElementById('monthly-total-calories').textContent = totalCalories;
        document.getElementById('meal-count').textContent = mealCount;

    } catch (error) {
        console.error("Error loading history:", error);
        mealHistoryList.innerHTML = '<p class="empty-state" style="color:red;">데이터를 불러오는 중 에러가 발생했습니다. (DB 권한 확인 필요)</p>';
    }
}
