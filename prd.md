# Product Requirements Document (PRD): Debate Platform
**Sürüm:** V1.1 (Detaylandırılmış ve Genişletilmiş Profesyonel Sürüm)
**Durum:** Hazır / Taslak (Draft)
**Tarih:** Şubat 2026

## 1. Yönetici Özeti (Executive Summary)
**Debate**, gerçek zamanlı sesli oda deneyimini kaotik bir sohbet ortamından çıkarıp düzenli, sürdürülebilir ve yönetilebilir bir kamusal tartışma altyapısına dönüştüren sosyal ses platformudur. Platform; Clubhouse'un spontane erişilebilirliği, X Spaces'in uçtan uca yayılım gücü ve profesyonel panel/münazara formatlarının yapısal disiplinini sentezler.

Oyunun kurallarını üç ana sütun ekseninde yeniden kurar:
1. **Düzen:** Rol bazlı katı hiyerarşi, mikrofon kuyruğu yönetimi ve sahne düzeni.
2. **Güven:** Çekirdek moderasyon araçları (Mute, Kick), Audit Log, olay raporlama ve şeffaflık.
3. **Ölçek:** WebRTC SFU Mimarisi, Stateless (Durumsuz) Signaling ve Redis tabanlı "Single Source of Truth" yaklaşımı.

---

## 2. Amaçlar ve Hedef Kitlesi (Personalar)
### 2.1 Problem ve Teşhis
Günümüz mevcut anlık ses platformlarında (X Spaces, Clubhouse) yaşanan kaotik konuşma akışları, zayıf ve yetersiz moderasyon araçları, oda kurucusu düştüğünde odanın bir anda dağılması (kaos) sorunu, ve büyük topluluklara uygun kaliteli içerik keşfinin zorluğu (hallway clutter problemi) gibi yapısal engeller mevcuttur.

### 2.2 Debate'in Çözüm Felsefesi / Farklılaştırıcılar
- **Moderatör Devri (Handover):** Oda sahibi internet bağlantısını kaybettiğinde odanın ani kapanmasını önleyen "Grace Period" (Geçiş Bekleme Süresi) ve deterministik halef (Successor) atama mekanizması.
- **Kesintisiz Deneyim:** Pod restartlarına ve websocket kopmalarına karşı dirençli stateless altyapı. Odanın durumu backend memory'sinde değil Redis üzerinde tutulur.
- **Genişleyebilir Tartışma İskeleti:** V1'de temel hiyerarşiyi sağlarken, V2 ve sonrasında süre sınırlı, turlu ve yapılandırılmış profesyonel tartışma (Debate) akışını taşıyacak tasarım.

### 2.3 Hedef Personalar ve Beklentileri
1. **Dinleyici (Listener):** Kaliteli içeriğe sürtünmesiz bağlanmak, kesintisiz ses kalitesi yaşamak ister. Kolay oda keşfi en önemli beklentisidir.
2. **Aktif Katılımcı (Speaker Adayı):** Moderatörden bağımsız, adil mikrofon tahsisi ister. Mikrofon talepleri listesinde adil bir yerleşim bekler.
3. **Moderatör / İçerik Üreticisi (Owner):** Odayı troll hesaplardan veya agresif katılımcılardan anında arındırmak (Mute/Kick) ister. Oda dinamiklerinin kontrolünü tamamen kendi panelinde hissetmelidir.

---

## 3. Ürün İlkeleri (Product Principles)
1. **Önce Ses Deneyimi:** Ağ koşulları ne olursa olsun ses gecikmesinin 200ms altında tutulması ve paket kaybının tolere edilmesi önceliktir.
2. **Moderatör Araçları Sonradan Eklenmez:** Mute, Kick, Mic Toggle fonksiyonları platformun lüksü değil, taban gereksinimidir (MVP).
3. **Stateless Ortam:** Socket node'ları çökerse oda ölmez. Tüm Presence, Mic Queue ve Speaker List bilgisi Redis üzerinden cache bazlı yönetilir.
4. **V1'de Kararlılık, V2'de Zeka:** İlk sürüm V1, "Room State" kırılmazlığını garanti eder. Yapay zeka manipülasyonları, duygu/toksisite analizleri ve ML destekli algoritmalar V2 ve sonrasının işidir.

---

## 4. Kullanıcı Yolculuğu ve Çekirdek Özellikler (MVP - V1)

### 4.1 Hesap, Auth ve Profil Yönetimi
- **Kayıt ve Giriş Protokolleri:** Google OAuth, X (Twitter) OAuth, E-posta (+ Şifre/Onay Linki), Telefon (SMS + OTP Doğrulama).
- **Zorunlu Profil Değişkenleri:** 
  - `username` (Benzersiz tanımlayıcı, değiştirilmesi rate-limit uygulanarak serbesttir).
  - `display_name` (UI gösterimi).
  - `avatar_url` (Custom upload veya varsayılan gravatar).
- **Opsiyonel Alanlar:** Kısa "Bio", ilgi alanları (etiketler) ve dil tercihi.
- **Hesap Evreleri:** `pending_verification`, `active`, `suspended` (topluluk kuralı ihlali kaynaklı), `deleted` (veri politikası gereği soft-delete uygulanır).

### 4.2 Hall (Ana Sayfa / Oda Keşfi)
- **Ana Feed (Canlı Odalar):** Aktif tüm odaların kartları. Başlık, Kategori, Dil, Sahibinin İsmi, ve güncel `speaker/listener` rakamları render edilir.
- **Algoritmik Keşif Sinyalleri (V1 Rule-Based):** V1 aşamasında odalar anlık dinleyici sayısına, odanın oluşturulma süresine (age penalty) ve kullanıcının profilindeki kategori eşleşmelerine göre basit skorlamalarla listelenir. Büyük ML ağırlıklı tavsiye motorları V2 için ertelenmiştir.
- **Oluşturma CTA:** Çok kolay erişilebilir, 2 tıklamada "Oda Aç" yeteneği.

### 4.3 Oda Yaşam Döngüsü ve İçi Roller
- **Yeni Oda Konfigürasyonu:**
  - `title`, `category`, `language` (Zorunlu ayarlar)
  - `visibility` (Public/Private - V1 aşamasındayken mimari güvenlik gereği yayın anında değiştirilemez).
  - `max_speakers` (Moderatör panelinden performans için kısıtlama: Örn. 6, 8, 10).
  - `mic_requests_enabled` (Mic Queue dinlenecek mi? Default: Toggle On).
- **Kullanıcı Rol Seviyeleri:**
  1. `owner_moderator`: Mutlak yönetici. Handover sürecinin de sahibidir.
  2. `moderator`: Owner tarafından atanan ek yöneticiler. İstekleri kabul edebilir, katılımcıyı Mute veya Kick yapabilir.
  3. `speaker`: Konuşmaya yetkili katılımcılar. Kullanıcının UI'sinde net biçimde hoparlör / ağ sinyali gücü belirtilir.
  4. `listener`: Sadece dinleme yetkisine sahip kullanıcı, "El Kaldırma" eylemi ile etkileşime geçebilir.

### 4.4 Mikrofon Talebi (Mic Request) - UX / Kural Seti
- **Davet Akışı (Invite-to-Speak):** Moderatör bir dinleyiciye davet gönderir. Kullanıcı tarafında onay pop-up'ı ("Kabul Et" / "Reddet") çıkar.
- **El Kaldırma (Hand Raise):** 
  - **Kuyruk Kontrolü:** İstekler moderatör paneline kesinlikle FIFO (İlk Giren İlk Çıkar) standardında düşer.
  - **Abuse/Spam Koruması (Cooldown - *Yenilik*):** Bir kullanıcı mikrofon isteğinde bulunup reddedilirse, yeni bir istek gönderebilmesi için X saniyelik (örn: 60 sn) "Cooldown" süresi işletilir. Kullanıcı aynı anda sadece bir aktif talebe sahip olabilir.
  - **Kapasite ve UX Uyarıları:** `max_speakers` limitine gelinmişse UI, moderatöre "Kapasite dolu, önce bir konuşmacıyı dinleyici statüsüne (`demote`) indirmelisiniz" şeklinde barikat kurar.
  - **Queue Kapatılması:** Moderatör `mic_requests` toggle'ını kapattığında yeni istek butonu Listener'larda deaktive olur ve görsel olarak "İstekler durduruldu" ifadesiyle netleştirilir.

### 4.5 Moderatör Devri (Handover) ve Kesintisiz Oda - [KRİTİK USP]
Debate'in temel yeniliği bu aşamadır. Owner bağlantısı koptuğunda:
1. **Grace Period (Geçiş ve Tolerans Süresi):**
   - Owner aniden düşerse oda kapatılmaz. Statü `grace_waiting_for_owner` durumuna çekilir (30-60 saniye bekler).
   - *UX:* Bu sürede konuşmacıların (Speaker) sesi kesilmez. Kullanıcıların arayüzlerinde zarif bir "Moderatörün bağlantısı koptu/bekleniyor..." banner'ı belirir.
2. **Deterministik Halef Atama (Successor Algorithm):** Tolerans süresi biterse ve Owner dönmezse sistem sırasıyla:
   1. Sahnede aktif başka bir `moderator` rolü var mı? Varsa en eskisini Owner Mode'a yükseltir.
   2. Yoksa, önceden atanmış tasarlanmış bir halef var mı? (V1.5 opsiyonu)
   3. Sahnede (`Speaker` listesinde) en uzun süredir bulunan konuşmacıyı bul, `owner_moderator` yap ve odayı çalışır bırak.
3. **Zorunlu Oda Kapatma (Graceful Shutdown):** Eğer tüm kurallardan sonuç alınamaz (Sahnede kimse yok vs.) ya da oda "idle" modda çok uzun kalırsa oda statüsü `ended` yapılıp Socket/Redis bağlantıları öldürülür.

---

## 5. Güvenlik, Şeffaflık ve Moderasyon
Güvenlik modülleri Debate projesi için MVP düzeyinin kalbidir:
- **Canlı Aksiyonlar:** "Mute" / "Unmute", Odadan süresiz Atma ("Kick"), "Speaker -> Listener düşürme".
- **Zorunlu Backend Audit Log (Denetim Kaydı):** 
  - Yapılan her moderasyon aksiyonu loglanmalıdır. Hangi moderatör `user_id` hangi kullanıcı `user_id`'yi, hangi `room_id` odasında hangi saatte Mute veya Kick yaptı?
  - Bu loglar, itirazlar veya Abuse yönetimini değerlendirecek olan yönetim paneli ve ileriki AI analitiği için temel oluşturur.
- **Kullanıcı/Oda Raporlaması:** Hall feedi üzerinden veya direkt odanın içinden "Taciz", "Nefret Söylemi", "Spam" tagleriyle anında içerik şikayet edebilme.

---

## 6. Mimari Temel Dağılım ve Altyapı
Sıfır hata toleransı ile seçilen V1 Tech Stack:
- **Ağ/Bağlantı Omurgası:** WebRTC
- **Realtime Media (SFU):** LiveKit (Düşük sunucu CPU maliyeti, geniş ölçek ve açık kaynak).
- **NAT Geçişleri / TURN:** Coturn serverları (Bağlantı sorunlarını aşmak için kritik).
- **Signaling Layer:** Go veya Node.js/NestJS bazlı tamamen *Stateless* yapı.
- **State Store (Oda Belleği):** Redis (Tüm Presence, Mic Request List, Handover statüleri). Veriler, TTL ile memory sızıntısına yol açmayacak biçimde depolanır.
- **Kalıcı (Persistent) Veri:** PostgreSQL (Hesaplar, Profil Detayları, Logs, Kapalı Oda Geçmişleri).

---

## 7. Temel Kenar Durumlar (Edge Cases)
Sistemin stabil kalmasını garantileyecek teknik ux gereksinimleri:
- **Okyanus Ortasında İnternet Kesintisi:** Owner'ın interneti kopsa bile, eğer odada 4 adet aktif `speaker` varsa tartışmaları zerre etkilenmez. Grace period sessizce işler, süre bitiminde aralarından biri "Sahibe/Moderatöre" otomatik terfi eder.
- **Tarayıcı Cihaz İzni Yetersizliği:** Bir kullanıcı `speaker` yapıldı ama tarayıcısına/mobil cihazına mikrofon izni vermemiş. UI, katılımcıyı `speaker` listesine koyar ama üzerinde "Cihaz izni veya donanımı yok" iconunu render eder. Konuşma trafiğine veya backend'e zarar vermez.
- **Connection Diagnostics:** Her `speaker` profil resmi üzerinde mini bir bağlantı sağlığı göstergesi (Ping veya Packet Loss indikatörü) bulunur. (Yeşil=Harika, Sarı=Gecikmeli, Kırmızı=Zayıf).

---

## 8. Başarı Metrikleri (North Star & KPIs)
- **North Star Metric:** Haftalık Nitelikli Sesli Etkileşim Dakikası (Moderatör devri (handover) yapılmış ve/veya kick yememiş sağlıklı tartışma süreleri).
- **Sistem KPI'ları:**
  - Join Success Rate: > %98
  - Reconnect Success Rate (Düşenlerin dönmesi): > %95
  - Ort. Ses Gecikmesi: < 200 ms
  - Packet Loss toleransı: < %1
- **Ürün Başarı KPI'ları:**
  - `Grace Period` çalıştıktan sonraki Başarılı `Handover` Tamamlanma Oranı: > %80.
  - Moda bağlı kalmadan odanın hayatta kalma endeksi.

---

## 9. Ürün Yol Haritası (Phasing)
- **V1 - Hazine (Foundation) [Şu Anki PRD]:** Komple auth yönetimi, Redis destekli statless room state yapısı, Handover fonksiyonları, Audit Logs ve temel Room UI. Moderasyon temelleri.
- **V1.5 - Sadakat (Engagement):** Creator Notification'ları, Odaları Önceden Planlama (Scheduled Rooms), Kapsamlı Topluluk Kuralları Gösterimi. Platforma takip edilebilir Dashboard ekimi.
- **V2 - Debate Karakteristiği (Identity):** Chat ve Soru/Cevap motoru. Her moderasyona kronometreli `turn engine` (Söz süresi motoru). Moderatörsüz tartışmalara özel AI tabanlı küfür/taciz moderasyonu (STT tabanlı uyarı), ve Replay özelliği.
- **V3 - Global Ölçeklenme (Scale & Intelligence):** Bölgesel/Kademeli SFU dağıtımları (Cascading). ML Destekli Discovery Engine feed ve podcast-benzeri kalıcı transkripsiyon.
