# Antenna Testing Guide — Інструкція для тестування у клієнта

## Підготовка

### На ПК клієнта (Linux Mint):

```bash
# 1. Встановити залежності
sudo apt install libusb-1.0-0-dev libudev-dev

# 2. Дати права на serial порти
sudo usermod -aG dialout $USER
# ПЕРЕЛОГІНИТИСЬ після цього!

# 3. Клонувати/оновити репозиторій
cd ~/localGit/rotation/GroundLink
git pull

# 4. Встановити пакети
npm install --legacy-peer-deps

# 5. Перезібрати native модулі для Electron
npx electron-rebuild

# 6. Запустити
npm run dev
```

### Перевірити що USB пристрої бачаться:

```bash
# Подивитись всі serial порти
ls -la /dev/ttyUSB* /dev/ttyACM* 2>/dev/null

# Або подивитись через dmesg
sudo dmesg -w
# (підключити USB пристрій — побачити яке ім'я отримав)

# Sine.link модем зазвичай:
# /dev/ttyUSB0, /dev/ttyUSB1 (два порти)
# Vendor: 1939, Product: 1945
```

---

## Тест 1: Ручне керування антеною через MAVLink serial

**Мета**: перевірити що антенний пристрій приймає servo команди через serial MAVLink.

**Обладнання**: тільки антенний пристрій (без Sine.link)

### Кроки:

1. **Підключити антенний пристрій** до USB
2. **Запустити GroundLink**: `npm run dev`
3. Відкрити **Antenna Control**
4. Увімкнути **Rotator**
5. Вибрати режим **SineLink**
6. Розгорнути панель (стрілка)
7. Натиснути **Scan ports**
8. В секції **Antenna (servo output)** — вибрати COM порт антенного пристрою
9. Натиснути **Connect**

### Що перевірити:

| Крок | Очікуваний результат | Якщо не працює |
|---|---|---|
| Scan ports | Порт антени з'явився в списку | Перевірити USB, `ls /dev/ttyUSB*` |
| Connect | Статус "Waiting..." (жовтий) або "Connected" (зелений) | Спробувати інший порт, перевірити baud rate |
| Heartbeat | Статус "Connected" (зелений) | Пристрій може не слати heartbeat — це ОК |

### Тестування повороту вручну:

10. **Power On** (кнопка внизу)
11. **Рухати компас** мишкою або стрілками клавіатури
12. Відкрити **DevTools** (Ctrl+Shift+I) → Console
13. Шукати логи: `[AntennaMavlink]`

### Що бачити в Console:

```
[AntennaMavlink] Connected to /dev/ttyUSB1 at 115200
```

Кожний раз коли рухаєте компас, servo команди відправляються. Якщо антена фізично підключена — вона повинна рухатись.

### Debug: перевірити що дані йдуть на serial порт

В **другому терміналі** можна підслухати порт:

```bash
# Показати що йде на порт (raw bytes)
cat /dev/ttyUSB1 | xxd | head -50
```

Або Python скрипт для перевірки:

```python
# test_antenna_listen.py
from pymavlink import mavutil
import sys

port = sys.argv[1] if len(sys.argv) > 1 else '/dev/ttyUSB1'
mav = mavutil.mavlink_connection(port, baud=115200)

print(f"Listening on {port}...")
while True:
    msg = mav.recv_match(blocking=True, timeout=5)
    if msg:
        print(f"Received: {msg.get_type()} from sys={msg.get_srcSystem()} comp={msg.get_srcComponent()}")
        if msg.get_type() == 'COMMAND_LONG':
            print(f"  Command: {msg.command}, Param1(servo): {msg.param1}, Param2(pwm): {msg.param2}")
    else:
        print("No message received (timeout)")
```

```bash
pip install pymavlink
python test_antenna_listen.py /dev/ttyUSB1
```

---

## Тест 2: Повний flow — Sine.link + Auto-tracking + Антена

**Мета**: перевірити повний ланцюг: модем → координати → bearing → servo → антена крутиться.

**Обладнання**: Sine.link Master + Slave (спаровані) + антенний пристрій

### Підготовка:

1. **Sine.link Slave** встановлений на дроні (або просто тримаєте в руці і ходите)
2. **Sine.link Master** підключений до ПК по USB
3. **Антенний пристрій** підключений до ПК по USB
4. Master і Slave **спаровані** і мають зв'язок

### Кроки:

1. **Запустити GroundLink**: `npm run dev`
2. Відкрити **Antenna Control**
3. Увімкнути **Rotator** → режим **SineLink**
4. Розгорнути панель
5. Натиснути **Scan ports**

#### 5a. Підключити Sine.link:
6. В **Sine.link (drone GPS)** — вибрати COM порт модему
   - Sine.link дає 2 порти: спробувати перший, якщо не працює — другий
7. Натиснути **Connect**
8. Чекати статус **"Receiving"** (зелений) — координати дрона приходять
   - Якщо **"Waiting..."** довше 10 секунд — неправильний порт, або Slave не в зоні

#### 5b. Підключити антену:
9. В **Antenna (servo output)** — вибрати COM порт антенного пристрою
   - Це ІНШИЙ порт, не той що Sine.link!
10. Натиснути **Connect**

#### 5c. Ввести GCS позицію:
11. Натиснути **Auto** (або ввести координати де стоїть антена)

#### 5d. Увімкнути tracking:
12. Увімкнути **Auto-track**
13. Натиснути **Power On**

### Що перевірити:

| Що | Очікуваний результат |
|---|---|
| Sine.link статус | "Receiving" (зелений), SNS position (conf: X > 0) |
| Drone координати | Lat, Lon, Alt відображаються |
| Bearing/Elev/Dist | Обчислюються, змінюються коли Slave рухається |
| Компас | Стрілка автоматично повертається до дрона |
| Антена | Фізично рухається слідом за компасом |

### Динамічний тест:

14. Взяти **Slave модем** і **піти в іншу сторону**
15. Спостерігати:
    - Bearing змінюється
    - Компас повертається
    - Антена слідкує

### Debug: Console логи

Відкрити DevTools (Ctrl+Shift+I) → Console. Ключові логи:

```
[Sinelink] Wire SDK initialized           ← WASM завантажено
[Sinelink] Connected to /dev/ttyUSB0      ← Порт відкрито
[Sinelink Store] Connected to /dev/ttyUSB0 ← Store отримав підтвердження
[AntennaMavlink] Connected to /dev/ttyUSB1 ← Антена підключена
```

### Якщо координати не приходять:

```bash
# Перевірити чи модем взагалі відповідає (Python)
# test_sinelink_pose.py
import sys
sys.path.insert(0, './wire/build/sine.wire/stubs')
sys.path.insert(0, './wire/build/sine.wire/int')

from pywire.wasm import WasmWire
from link_v1_pb2 import Object, viGetPose

wire = WasmWire("./wire/build/sine.wire/lib/")

# Через USB
import usb.core
dev = usb.core.find(idVendor=0x1939, idProduct=0x1945)
if dev:
    print(f"Found Sine.link: {dev}")

    # Створити запит viGetPose
    req = Object()
    req.header.type = viGetPose
    proto = req.SerializeToString()
    raw = wire.proto_to_link(proto)

    dev.write(0x01, raw)
    resp_raw = dev.read(0x82, 64, timeout=1000).tobytes()

    resp_proto = wire.link_to_proto(resp_raw)
    resp = Object()
    resp.ParseFromString(resp_proto)

    if resp.pose:
        print(f"Lat: {resp.pose.lat}, Lon: {resp.pose.lon}, Alt: {resp.pose.alt}")
        print(f"Valid: {resp.pose.valid}, Confidence: {resp.pose.confidence}")
    else:
        print(f"Response type: {resp.header.type}")
else:
    print("Sine.link not found via USB")
```

```bash
pip install pyusb
python test_sinelink_pose.py
```

---

## Тест 3: Перевірка окремих компонентів

### 3a. Чи бачить система serial порти?

```bash
# В GroundLink DevTools Console:
# Відкрити Console, ввести:
require('serialport').SerialPort.list().then(ports => console.table(ports))
```

### 3b. Чи працює Wire SDK WASM?

В Console:
```
# При підключенні Sine.link порту повинно бути:
[Sinelink] Wire SDK initialized
# Якщо помилка — WASM файл не знайдено
```

### 3c. Чи відправляються MAVLink фрейми на антену?

В Console шукати після кожного руху компасу або auto-track оновлення. Якщо потрібен детальний лог, можна тимчасово додати в DevTools:

```javascript
// В Console браузера GroundLink:
localStorage.setItem('debug-antenna-mavlink', 'true')
```

### 3d. PWM значення коректні?

```
Azimuth 0° → PWM ~1470 (центр)
Azimuth 90° → PWM ~1935
Azimuth -90° (270° UI) → PWM ~1005
Elevation 0° → CMD 0
Elevation 45° → CMD 35
Elevation 90° → CMD 80
```

---

## Чеклист для клієнта

### Перед тестуванням:
- [ ] Linux: `sudo usermod -aG dialout $USER` + перелогін
- [ ] `npm install --legacy-peer-deps`
- [ ] `npx electron-rebuild`
- [ ] USB пристрої підключені і бачаться (`ls /dev/ttyUSB*`)

### Тест 1 (антена вручну):
- [ ] Scan ports показує порти
- [ ] Antenna Connect працює
- [ ] Рух компасу → антена рухається

### Тест 2 (повний flow):
- [ ] Sine.link Connect → "Receiving"
- [ ] Координати дрона відображаються
- [ ] GCS позиція введена
- [ ] Auto-track → компас слідкує за дроном
- [ ] Антена фізично повертається

### Після тестування — записати:
- [ ] Які COM порти використовувались (Sine.link: ___, Antenna: ___)
- [ ] Baud rate (115200?)
- [ ] Які servo канали працюють (1 = azimuth, 2 = elevation?)
- [ ] Чи потрібен heartbeat для антенного пристрою?
- [ ] Target system/component ID антенного пристрою
- [ ] Скріншоти DevTools Console з помилками (якщо є)

---

## Типові проблеми та рішення

| Проблема | Причина | Рішення |
|---|---|---|
| Scan ports пустий | Немає прав або пристрій не підключений | `sudo usermod -aG dialout $USER`, перелогін |
| "OPEN_FAILED" | Порт зайнятий або не існує | Закрити інші програми що використовують порт |
| Sine.link "Waiting..." | Неправильний порт, або нема відповіді | Спробувати інший порт, перевірити baud |
| Wire SDK init failed | WASM файл не знайдено | Перевірити `wire/build/sine.wire/lib/sine_wire.wasm` |
| Координати 0,0 | Slave не в зоні або SNS не налаштований | Перевірити радіозв'язок, SNS profile |
| Антена не рухається | Неправильний servo channel або target ID | Уточнити у виробника антени servo channels |
| Мертва зона (164-196°) | Нормальна поведінка | Антена не може повернутись назад — by design |
