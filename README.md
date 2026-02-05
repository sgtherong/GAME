# 블록블래스트 클론 게임

간단한 **Block Blast 스타일의 퍼즐 게임**입니다. 브라우저에서 바로 실행할 수 있고, PC/모바일 모두에서 마우스(또는 터치)로 플레이할 수 있습니다.

## 실행 방법

1. 이 폴더(`d:\GOLDENBLAST`)를 VSCode/Cursor에서 엽니다.
2. 아래 둘 중 편한 방법으로 실행하세요.

- **방법 1 – 브라우저에서 바로 열기**
  - `index.html` 파일을 더블 클릭해서 브라우저에서 엽니다.

- **방법 2 – 간단 서버 실행 (선택)**
  - 터미널에서 이 폴더로 이동 후:
    ```bash
    npm install
    npm run start
    ```
  - 터미널에 표시되는 로컬 주소를 브라우저로 엽니다.

## GitHub로 공유하는 방법

코드를 GitHub에 올려두면 **다른 사람이 코드를 받아서 실행**할 수 있고, **GitHub Pages**를 켜면 **브라우저로 바로 플레이할 수 있는 링크**도 만들 수 있습니다.

### 1단계: GitHub 저장소 만들기

1. [GitHub](https://github.com/) 에 가입하거나 로그인합니다.
2. 오른쪽 위 **+** → **New repository** 를 클릭합니다.
3. **Repository name**에 예: `goldenblast` 처럼 이름을 넣습니다.
4. **Public** 을 선택하고, **Create repository** 를 누릅니다.
5. 생성된 페이지에 나오는 **저장소 주소**를 복사해 둡니다.  
   예: `https://github.com/내아이디/goldenblast.git`

### 2단계: 프로젝트 폴더를 Git으로 올리기

**이 프로젝트 폴더**(예: `d:\GOLDENBLAST`)에서 터미널(또는 Cursor 터미널)을 열고 아래를 **순서대로** 실행합니다.

```bash
# 1) 이 폴더를 Git 저장소로 만듦
git init

# 2) 모든 파일 추가
git add .

# 3) 첫 커밋
git commit -m "Add Treasure Vault game"

# 4) 기본 브랜치 이름을 main으로
git branch -M main

# 5) 방금 만든 GitHub 저장소 연결 (주소는 본인 걸로 바꾸기)
git remote add origin https://github.com/내아이디/goldenblast.git

# 6) GitHub로 올리기
git push -u origin main
```

- **처음에 Git을 쓰는 경우**  
  `git config --global user.email "이메일"` , `git config --global user.name "이름"` 을 한 번만 설정해 두면 됩니다.

- **`git push` 할 때 로그인 창**이 뜨면 GitHub 아이디·비밀번호(또는 Personal Access Token)를 입력하면 됩니다.

### 3단계: 공유하기

- **코드만 공유**: 저장소 주소 `https://github.com/내아이디/goldenblast` 를 친구에게 보내면, **Code** → **Download ZIP** 으로 받아서 압축 풀고 `index.html` 을 열면 됩니다.
- **웹에서 바로 플레이 링크 만들기**: 아래 "GitHub Pages로 누구나 플레이 링크 만들기" 를 진행합니다.

### GitHub Pages로 누구나 플레이 링크 만들기

1. GitHub에서 **해당 저장소** 페이지로 갑니다.
2. 위 메뉴에서 **Settings** 를 클릭합니다.
3. 왼쪽에서 **Pages** 를 클릭합니다.
4. **Build and deployment** 아래 **Source** 를 **Deploy from a branch** 로 선택합니다.
5. **Branch** 를 `main` (또는 사용 중인 브랜치), **Folder** 를 **/ (root)** 로 선택한 뒤 **Save** 를 누릅니다.
6. 1~2분 정도 지나면 **Pages** 페이지 상단에  
   `https://내아이디.github.io/goldenblast/`  
   같은 주소가 나타납니다. 이 주소를 친구에게 보내면 **브라우저에서 바로 게임**을 할 수 있습니다.

---

- **코드만 공유** → 저장소 링크만 보내면 됩니다.  
- **웹에서 바로 플레이** → GitHub Pages를 켜고 나온 `https://...github.io/저장소이름/` 주소를 공유하면 됩니다.

## 모바일로 접속하는 방법

같은 Wi‑Fi에 연결된 **휴대폰**에서도 플레이할 수 있습니다.

1. **PC에서 서버 실행**
   - 이 폴더에서 터미널을 열고:
     ```bash
     npm run start
     ```
   - 터미널에 예: `http://localhost:3000` 같은 주소가 뜹니다.

2. **PC의 IP 주소 확인**
   - **Windows**: 터미널에서 `ipconfig` 입력 후, "IPv4 주소" (예: `192.168.0.10`) 확인.
   - **Mac**: 터미널에서 `ifconfig | grep "inet "` 또는 시스템 설정 → 네트워크에서 확인.

3. **휴대폰에서 접속**
   - 휴대폰 브라우저(Chrome, Safari 등) 주소창에 입력:
     ```
     http://PC의IPv4주소:3000
     ```
     예: `http://192.168.0.10:3000`
   - 포트가 3000이 아니면 터미널에 나온 포트 번호를 사용하세요.

4. **홈 화면에 추가 (선택)**  
   - 브라우저 메뉴에서 "홈 화면에 추가" 또는 "Add to Home Screen"을 누르면 앱처럼 실행할 수 있습니다.

게임은 터치로 블럭을 드래그해 보드에 놓는 방식으로 동작합니다.

## 외부에 있는 사람들이 플레이할 수 있게 하기

다른 Wi‑Fi나 다른 지역에 있는 사람에게 **링크 하나만 보내서** 플레이하게 하려면 아래 둘 중 하나를 쓰면 됩니다.

---

### 방법 A: 잠깐 공유 (테스트·친구 초대용)

PC에서 서버를 켜 둔 채로, **임시 공개 주소**를 만들어 링크를 공유하는 방법입니다.  
PC를 끄거나 서버를 중지하면 링크는 더 이상 열리지 않습니다.

1. **ngrok 사용 (가장 간단)**

   - [ngrok 가입](https://ngrok.com/) 후 설치 (또는 `npm install -g ngrok`).
   - 터미널 1: 이 폴더에서 `npm run start` 로 서버 실행 (예: 포트 3000).
   - 터미널 2: `ngrok http 3000` 실행.
   - 터미널에 나오는 **https://xxxx.ngrok.io** 같은 주소를 복사해서 친구에게 보내면 됩니다.

2. **Cloudflare Tunnel (무료, 가입 필요)**

   - [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) 에서 계정 생성 후 **Quick Tunnels** 또는 **cloudflared** 설치.
   - 로컬에서 `npm run start` 로 서버 실행한 뒤, 터널로 3000 포트를 노출하면 공개 URL이 생성됩니다. 이 URL을 공유하면 됩니다.

---

### 방법 B: 항상 열려 있는 주소 (배포)

**인터넷에 게임을 올려두면** PC를 끄지 않아도 누구나 24시간 접속할 수 있습니다. 아래는 모두 무료로 쓸 수 있는 서비스입니다.

#### 1) Netlify (추천 – 가장 쉬움)

1. [Netlify](https://www.netlify.com/) 가입 후 로그인.
2. **Sites** → **Add new site** → **Deploy manually**.
3. 이 프로젝트 **폴더 전체**를 드래그해서 올리면 됩니다 (또는 터미널에서 `npx netlify deploy` 사용 가능).
4. 배포가 끝나면 `https://랜덤이름.netlify.app` 같은 주소가 생깁니다. 이 주소를 공유하면 됩니다.

#### 2) GitHub Pages

1. 이 프로젝트를 **GitHub 저장소**에 올립니다 (Git이 설치되어 있다면):
   ```bash
   git init
   git add .
   git commit -m "Treasure Vault game"
   git branch -M main
   git remote add origin https://github.com/당신아이디/저장소이름.git
   git push -u origin main
   ```
2. GitHub 저장소 페이지 → **Settings** → **Pages**.
3. **Source**를 **Deploy from a branch**로 두고, **Branch**를 `main`, 폴더를 **/ (root)** 로 선택 후 Save.
4. 몇 분 뒤 `https://당신아이디.github.io/저장소이름/` 주소로 접속할 수 있습니다. 이 주소를 공유하면 됩니다.

#### 3) Vercel

1. [Vercel](https://vercel.com/) 가입 후, **Add New** → **Project**.
2. GitHub에 코드가 있으면 저장소를 연결하거나, **Import**에서 이 폴더를 업로드.
3. 배포 후 `https://프로젝트이름.vercel.app` 같은 주소가 생깁니다. 이 주소를 공유하면 됩니다.

---

- **잠깐만 링크 공유** → 방법 A (ngrok / Cloudflare Tunnel).  
- **항상 누구나 접속 가능하게** → 방법 B (Netlify / GitHub Pages / Vercel) 중 하나로 배포하면 됩니다.

## 게임 규칙

- 10×10 보드 위에서 **블록 3개 세트**가 주어집니다.
- 블록을 **드래그하여 보드 위에 올려놓을 수 있는 곳에만** 놓을 수 있습니다.
- 가로 줄 또는 세로 줄 하나를 **전부 채우면 그 줄이 사라지고 점수**를 얻습니다.
- 한 번에 여러 줄을 지우면 추가 점수를 더 받습니다.
- 현재 보드 상태에서 **어떤 블록도 더 이상 놓을 수 없으면 게임 오버**입니다.
- 최고 점수는 브라우저 `localStorage`에 저장됩니다.

## 커스터마이징

- 블록 모양을 바꾸고 싶다면 `game.js`의 `SHAPES` 배열을 수정하세요.
- 보드 크기를 바꾸고 싶다면 `BOARD_SIZE` 상수를 수정하고, CSS의 `.board { --size: 10; }` 값도 동일하게 변경하세요.
