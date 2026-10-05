document.addEventListener('DOMContentLoaded', () => {
    const TOTAL_SEATS = 36;
    const MAX_STUDENTS = 34;
    
    // 生徒データ初期化 (1〜34番、奇数は男、偶数は女を初期値とする)
    let students = [];
    for (let i = 1; i <= MAX_STUDENTS; i++) {
        students.push({
            id: i,
            gender: i % 2 === 1 ? 'm' : 'f',
            isPresent: true
        });
    }

    // 空席座標の初期化 (デフォルトは最後の2つ [34, 35] ※0ベースインデックス)
    let emptySeats = new Set([34, 35]);

    // DOMの取得
    const studentSettingsDiv = document.getElementById('student-settings');
    const seatingChartDiv = document.getElementById('seating-chart');
    const genderPatternSelect = document.getElementById('gender-pattern');
    const shuffleBtn = document.getElementById('shuffle-btn');

    // 1. 名簿設定UIのレンダリング
    function renderStudentSettings() {
        studentSettingsDiv.innerHTML = '';
        students.forEach(student => {
            const item = document.createElement('div');
            item.className = `student-item ${student.isPresent ? '' : 'disabled'}`;

            // 出席チェックボックス
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = student.isPresent;
            cb.addEventListener('change', () => {
                student.isPresent = cb.checked;
                item.classList.toggle('disabled', !cb.checked);
            });

            // 番号ラベル
            const label = document.createElement('span');
            label.textContent = `${student.id}番`;

            // 性別切り替えボタン
            const genderBtn = document.createElement('button');
            genderBtn.className = `gender-btn ${student.gender === 'm' ? 'male' : 'female'}`;
            genderBtn.textContent = student.gender === 'm' ? '男' : '女';
            genderBtn.addEventListener('click', (e) => {
                e.preventDefault();
                student.gender = student.gender === 'm' ? 'f' : 'm';
                genderBtn.className = `gender-btn ${student.gender === 'm' ? 'male' : 'female'}`;
                genderBtn.textContent = student.gender === 'm' ? '男' : '女';
            });

            item.appendChild(cb);
            item.appendChild(label);
            item.appendChild(genderBtn);
            studentSettingsDiv.appendChild(item);
        });
    }

    // 2. 座席盤面（空席設定用）の初期レンダリング
    function renderSeatingChart() {
        seatingChartDiv.innerHTML = '';
        for (let i = 0; i < TOTAL_SEATS; i++) {
            const seat = document.createElement('div');
            seat.className = 'seat';
            seat.dataset.index = i;

            if (emptySeats.has(i)) {
                seat.classList.add('empty-seat');
            }

            // クリックで空席/通常席を切り替え
            seat.addEventListener('click', () => {
                if (emptySeats.has(i)) {
                    emptySeats.delete(i);
                    seat.classList.remove('empty-seat');
                } else {
                    // 現在の出席人数から必要な座席数を計算
                    const activeStudentsCount = students.filter(s => s.isPresent).length;
                    const maxAllowedEmpty = TOTAL_SEATS - activeStudentsCount;

                    if (emptySeats.size >= maxAllowedEmpty) {
                        alert(`出席する生徒が ${activeStudentsCount} 人いるため、空席は最大 ${maxAllowedEmpty} 箇所までしか設定できません。`);
                        return;
                    }
                    emptySeats.add(i);
                    seat.classList.add('empty-seat');
                }
            });

            seatingChartDiv.appendChild(seat);
        }
    }

    // 3. 特定の座席インデックス(0~35)が指定パターンで男(m)か女(f)かを判定
    function getExpectedGender(index, pattern) {
        const row = Math.floor(index / 6);
        const col = index % 6;

        switch (pattern) {
            case 'ichimatsu-m': // 市松模様（左上男）
                return (row + col) % 2 === 0 ? 'm' : 'f';
            case 'ichimatsu-f': // 市松模様（左上女）
                return (row + col) % 2 === 0 ? 'f' : 'm';
            case 'stripe-v':    // 縦縞
                return col % 2 === 0 ? 'm' : 'f';
            case 'stripe-h':    // 横縞
                return row % 2 === 0 ? 'm' : 'f';
            default:
                return 'm';
        }
    }

    // 配列をシャッフルするヘルパー
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // 4. 席替え実行ロジック
    function shuffleSeats() {
        // 出席する生徒のみを抽出
        const activeStudents = students.filter(s => s.isPresent);
        const males = shuffleArray(activeStudents.filter(s => s.gender === 'm'));
        const females = shuffleArray(activeStudents.filter(s => s.gender === 'f'));

        const pattern = genderPatternSelect.value;
        const seatElements = seatingChartDiv.children;

        // 一旦すべての席の割り当て表示をクリア
        for (let i = 0; i < TOTAL_SEATS; i++) {
            seatElements[i].innerHTML = '';
            seatElements[i].className = 'seat' + (emptySeats.has(i) ? ' empty-seat' : '');
        }

        // 配置しきれなかった残り生徒を入れるためのバッファ
        let leftoverStudents = [];

        // ファーストパス: 各席の「指定性別」に合わせて生徒を配置
        for (let i = 0; i < TOTAL_SEATS; i++) {
            if (emptySeats.has(i)) continue;

            const targetGender = getExpectedGender(i, pattern);
            let chosenStudent = null;

            if (targetGender === 'm' && males.length > 0) {
                chosenStudent = males.shift();
            } else if (targetGender === 'f' && females.length > 0) {
                chosenStudent = females.shift();
            }

            if (chosenStudent) {
                assignStudentToSeat(seatElements[i], chosenStudent);
            } else {
                // 片方の性別が足りなくなったら、この席はセカンドパスで埋めるためにマーク
                seatElements[i].dataset.pending = 'true';
            }
        }

        // 残った生徒を1つのプールに結合
        leftoverStudents = [...males, ...females];

        // セカンドパス: 性別が合わずに空いてしまった席に、残った生徒をランダムに配置
        for (let i = 0; i < TOTAL_SEATS; i++) {
            if (seatElements[i].dataset.pending === 'true') {
                delete seatElements[i].dataset.pending;
                
                if (leftoverStudents.length > 0) {
                    const chosenStudent = leftoverStudents.shift();
                    assignStudentToSeat(seatElements[i], chosenStudent);
                }
            }
        }
    }

    // 座席に生徒の要素を書き込むヘルパー
    function assignStudentToSeat(seatElement, student) {
        seatElement.classList.add('assigned', student.gender);
        
        const numSpan = document.createElement('span');
        numSpan.className = 'seat-num';
        numSpan.textContent = student.id;

        const genderSpan = document.createElement('span');
        genderSpan.className = 'seat-gender';
        genderSpan.textContent = student.gender === 'm' ? '男子' : '女子';

        seatElement.appendChild(numSpan);
        seatElement.appendChild(genderSpan);
    }

    // ボタンイベント登録
    shuffleBtn.addEventListener('click', shuffleSeats);

    // 初期化実行
    renderStudentSettings();
    renderSeatingChart();
});
