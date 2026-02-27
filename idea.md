# idea.md — Debade / Debate
> **Çalışma adı:** Debate (öneri: marka tutarlılığı için tek isimde karar verin)  
> **Versiyon:** v1.0 (İlk kapsamlı ürün fikri dokümanı)  
> **Dil:** Türkçe  
> **Amaç:** Ürünün vizyonunu, kullanıcı deneyimini, teknik temelini, ölçeklenme yaklaşımını ve farklılaşma stratejisini en ince detayına kadar tanımlamak

---

## 1) Ürün Tanımı (One-liner)

**Debate**, insanların sesli odalarda fikir, siyaset, ilim/irfan, tarih, ekonomi ve gündem konularını düzenli ve moderasyon destekli biçimde tartışabildiği, gerçek zamanlı sosyal ses platformudur.

Bu ürün, sıradan “sesli sohbet” uygulaması değildir.  
Temel farkı: **yapılandırılmış tartışma, rol bazlı moderasyon, konuşma sırası yönetimi, güvenli topluluk deneyimi ve ölçeklenebilir gerçek zamanlı altyapı**.

---

## 2) Neden Bu Ürün? (Problem ve Fırsat)

### 2.1 Problem
Mevcut sosyal ses platformlarında şu sorunlar yaygındır:
- Konuşma akışının dağınık olması (kaos / üst üste konuşma)
- Zayıf moderasyon araçları
- Tartışmanın niteliğini artıracak yapıların olmaması
- Konu keşfinin zor olması (“hallway clutter” problemi)
- Büyük odalarda kalite ve kontrol kaybı
- Toksisite, hakaret, spam ve kutuplaşma riski
- Üretici/moderatör için anlamlı içgörü eksikliği

### 2.2 Fırsat
İnsan sesi, metne göre:
- daha doğal,
- daha hızlı,
- daha duygulu,
- daha ikna edici,
- daha topluluk kurucu bir iletişim formatı sunar.

Özellikle:
- siyaset,
- fikir tartışmaları,
- ilim/irfan sohbetleri,
- panel formatları,
- uzman konuşmaları
için sesli format çok güçlüdür.

### 2.3 Debate’in Çözüm Tezi
Debate, “sesli oda” deneyimini şu üç sütun üzerinde yeniden kurar:
1. **Düzen (Structured Conversation)**
2. **Güven (Trust & Moderation)**
3. **Ölçek (Realtime + scalable architecture)**

---

## 3) Vizyon, Misyon ve Konumlandırma

## 3.1 Vizyon
İnsanların fikirlerini medeni, güçlü ve erişilebilir biçimde tartışabildiği, ses merkezli dijital kamusal alanı inşa etmek.

## 3.2 Misyon
Canlı tartışmaları:
- daha erişilebilir,
- daha düzenli,
- daha güvenli,
- daha kaliteli,
- daha sürdürülebilir
hale getiren bir platform sunmak.

## 3.3 Konumlandırma
Debate:
- Clubhouse’un spontane doğasını,
- X Spaces’in dağıtım gücünü,
- ve profesyonel panel/münazara sistemlerinin disiplinini
tek platformda birleştirir.

---

## 4) Ürünün Temel Farklılaştırıcıları

## 4.1 “Sadece sesli oda” değil, “tartışma platformu”
Debate’in çekirdeği, oda açma özelliği değil; **tartışma yönetimi**dir.

### Öne çıkan farklar
- Rol bazlı yetki sistemi (owner mod / moderator / speaker / listener)
- Mikrofon talep kuyruğu (queue)
- Konuşmaya davet + kabul/red akışı
- Moderatör devri (host çıkınca kaos olmaması)
- Tartışma düzeni için kurallı oda kurguları (V2+)
- Güvenlik ve moderasyon için teknik omurga
- Discovery (keşif) ve feed mantığı

## 4.2 “Siyaset + fikir + ilim/irfan” odaklı tasarım
Platform genel sohbet için de kullanılabilir, ancak asıl ürün kimliği:
- fikir çatışmalarını yönetebilen,
- çok sesliliği destekleyen,
- kontrollü tartışmayı mümkün kılan
bir yapıya dayanır.

---

## 5) Hedef Kullanıcılar (Persona Seti)

## 5.1 Dinleyici (Listener)
**Motivasyon:** İlgilendiği konuda kaliteli konuşmaları takip etmek  
**Beklenti:** Düşük sürtünme, iyi ses kalitesi, kolay oda keşfi  
**Sorun:** Karmaşık oda listeleri, toksik ortamlar, bağlanma sorunları

## 5.2 Aktif Katılımcı / Tartışmacı (Speaker adayı)
**Motivasyon:** Söz almak, fikir belirtmek, görünür olmak  
**Beklenti:** Mikrofon talebinin adil yönetimi, net söz hakkı  
**Sorun:** Kaos, kayırmacılık hissi, moderatör belirsizliği

## 5.3 Moderatör (Oda Kurucusu)
**Motivasyon:** Kaliteli bir tartışma yürütmek  
**Beklenti:** Güçlü yönetim araçları, hızlı aksiyon, düzenli akış  
**Sorun:** Kontrol kaybı, spam/troll, anlık teknik sorunlar

## 5.4 İçerik Üreticisi / Topluluk Lideri
**Motivasyon:** Düzenli oturumlar, kitle oluşturma  
**Beklenti:** Keşif, takipçi dönüşümü, oda performansı görünürlüğü  
**Sorun:** Platform araçlarının yetersizliği, düşük retention

## 5.5 Uzman / Akademisyen / Gazeteci (V2+ odak personası)
**Motivasyon:** Güvenilir tartışma ortamı, saygın görünürlük  
**Beklenti:** Düzgün moderasyon, kayıt/replay, konu disiplini  
**Sorun:** Toksik ortamlar, ciddiyetsiz etkileşimler

---

## 6) Ürün İlkeleri (Product Principles)

1. **Önce ses deneyimi:** Ses kalitesi ve düşük gecikme ana unsurdur.
2. **Önce düzen:** Oda yönetimi kaotik değil, kontrollü olmalıdır.
3. **Önce güven:** Moderasyon araçları sonradan eklenen değil, çekirdek özellik olmalıdır.
4. **Basit giriş, güçlü çekirdek:** Kullanıcı onboarding hızlı; oda içi sistem profesyonel.
5. **Kademeli karmaşıklık:** V1 sade, V2/V3 ileri seviye (AI moderation, structured debate engine, replay analytics).
6. **Stateless realtime mantık:** Bağlantı kopsa da oda state’i hayatta kalmalı.
7. **Ölçek bir özellik:** Büyük odalara giden yol mimaride en baştan düşünülmeli.

---

## 7) Kullanıcı Yolculuğu (End-to-End)

## 7.1 Giriş / Kayıt (Auth)
Kullanıcı web sitesine girer ve şu yöntemlerden biriyle giriş yapar / kayıt olur:
- Google OAuth
- X OAuth
- E-posta + şifre
- Telefon numarası + SMS OTP

### OAuth (Google / X)
- Kullanıcı sağlayıcı ile auth olur
- Sağlayıcıdan gelen temel profil bilgileri alınır (ad, e-posta varsa, avatar varsa, provider id)
- Sistem mevcut kullanıcı eşleşmesi yapar
- Yoksa yeni kullanıcı oluşturur
- Hesap `active` olur
- İlk girişte `username` ve profil tamamlama akışı gösterilir

### E-posta ile kayıt
- Kullanıcı e-posta + şifre + username girer
- Hesap `pending_email_verification` olarak oluşturulur
- Aktivasyon maili gönderilir
- Kullanıcı linke tıklayınca `active` olur

### Telefon ile kayıt
- Kullanıcı telefon numarası girer
- SMS OTP gönderilir
- OTP doğrulanınca hesap oluşturulur/aktif edilir
- Kullanıcı `username` belirler

---

## 7.2 Hesap Durumları (Account State Machine)
- `pending_email_verification`
- `pending_phone_verification`
- `active`
- `suspended`
- `deactivated`
- `deleted` (soft delete önerilir)

Bu durumlar; ban, itiraz, geri açma ve güvenlik süreçleri için kritiktir.

---

## 7.3 Profil Oluşturma ve Düzenleme
Her kullanıcının düzenlenebilir profili olur.

### Profil alanları (V1)
#### Zorunlu
- `username` (benzersiz)
- `display_name`
- `avatar_url` (varsayılan avatar olabilir)

#### Opsiyonel
- kısa biyografi (`bio`)
- ilgi alanları (etiketler)
- dil tercihi (TR/EN)
- şehir/ülke (opsiyonel)

### Profil düzenleme aksiyonları
- avatar yükleme/değiştirme
- bio düzenleme
- display name güncelleme
- username değiştirme (rate limit ile)

### Ürün notu
Profil verisi, Hall ve oda içi katılımcı listelerinde çok sık görüntüleneceği için:
- statik alanlar (avatar, bio, display name) client cache/CDN ile verimli taşınmalıdır
- dinamik alanlar (online state vb.) canlı güncellenebilir

---

## 7.4 Hall (Lobby / Feed) Ana Sayfa
Giriş yapan kullanıcı “Hall” ekranına gelir.

### Hall ekranı amaçları
- Kullanıcıya canlı odaları göstermek
- Keşfi kolaylaştırmak
- Oda açma eylemini teşvik etmek
- İlgili içeriklere hızlı giriş sağlamak

### Hall bileşenleri (V1)
1. **Canlı Odalar Feed’i**
2. **Öne çıkan / trend odalar**
3. **Kategori filtreleri** (Siyaset, Ekonomi, Tarih, Bilim, Kültür...)
4. **Arama**
5. **Oda Aç** butonu

### Oda kartı içeriği
- Oda başlığı
- Kategori
- Dil
- Moderatör adı
- Konuşmacı sayısı
- Dinleyici sayısı
- Oda görünürlüğü (public/private)
- Canlı durumu
- (Opsiyonel) Mikrofon talepleri açık/kapalı bilgisi

---

## 7.5 Odaya Katılım
Kullanıcı Hall’den bir odaya tıklar.

### Oda giriş kontrolleri
- Oda `live` mi?
- Kullanıcı odadan yasaklı mı?
- Oda kapasitesi dolu mu? (listener limit varsa)
- Private oda ise giriş yetkisi var mı?

### Başlangıç rolü
Kullanıcı odaya **listener** olarak girer (varsayılan).

---

## 7.6 Yeni Oda Açma
Kullanıcı “Oda Aç” butonuna tıklar.

### Oda oluşturma alanları (V1)
- Oda başlığı (`title`) — zorunlu
- Kısa konu / açıklama (`description`) — önerilir
- Kategori (`category`)
- Dil (`language`)
- Görünürlük (`public` / `private`)
- Mikrofon talebi (`mic_requests_enabled`) — varsayılan açık
- Maks konuşmacı sayısı (`max_speakers`) — örn. 6/8/10

### Oda oluşturulunca
- Oda DB’de oluşturulur
- Oda durumu `live`
- Kurucu kullanıcı odaya otomatik alınır
- Rolü `owner_moderator` olur

---

## 7.7 Oda İçi Roller
Debate, rol bazlı bir oda sistemidir.

### Roller
1. `owner_moderator` (odayı açan kişi)
2. `moderator`
3. `speaker`
4. `listener`

---

## 7.8 Konuşmacı Daveti (Moderator Invite Flow)
Moderasyon akışının kritik parçasıdır.

### Akış
1. Moderator bir `listener` seçer
2. “Konuşmaya davet et” aksiyonu tetiklenir
3. Kullanıcıya popup gider:
   - Kabul et
   - Reddet
4. Kullanıcı kabul ederse rolü `speaker` olur
5. Reddederse davet kapanır

### Tasarım kararları
- Tek kullanıcı için aynı anda tek aktif konuşmacı daveti
- Davetlerin süresi (örn. 30-60 sn) dolabilir
- Moderator panelinde davetin durumu görünür (`pending`, `accepted`, `rejected`, `expired`)

---

## 7.9 Mikrofon Talebi / Söz Alma (Hand Raise)
Listener’ın gönüllü katılım mekanizmasıdır.

### Akış
1. Listener “Mikrofon Talebi” gönderir
2. Talep moderatör panelindeki kuyruğa düşer
3. Moderator:
   - Kabul eder → `listener -> speaker`
   - Reddeder → talep kapanır
4. Kullanıcıya sonuç bildirilir

### Kural seti
- Aynı kullanıcı aynı anda birden fazla `pending` talep gönderemez
- Talep kuyruğu timestamp bazlı işlenir (FIFO)
- Mikrofon talepleri moderatör tarafından açılıp kapatılabilir

---

## 7.10 Mikrofon Taleplerini Aç/Kapat
Moderator, odanın düzenine göre mic request sistemini yönetebilir.

### Durumlar
- `mic_requests_enabled = true`
- `mic_requests_enabled = false`

### Kullanıcı deneyimi
- Kapalıysa listener tarafında buton pasif olur ve açıklama gösterilir
- Açıkken normal hand raise akışı çalışır

---

## 7.11 Moderatör Devri ve Oda Sürekliliği (Kritik Ürün Farkı)
Bu özellik, Debate’i profesyonel seviyeye taşıyan ana mekanizmalardan biridir.

### Problem
Oda kurucusu/moderatör odadan çıkarsa:
- oda hemen kapanırsa kullanıcı deneyimi bozulur
- oda kontrolsüz kalırsa kaos oluşur

### Çözüm: Otomatik Moderasyon Devri (Handover)
Owner/mod çıkınca sistem şu akışı uygular:

#### 1) Grace Period
- Oda hemen kapanmaz
- `grace_waiting_for_owner` durumuna geçer
- Örn. 30–60 saniye owner’ın geri dönmesi beklenir

#### 2) Halef Arama (Successor Selection)
Owner dönmezse sistem deterministik sırayla yeni moderatör seçer:

1. Aktif başka moderator varsa → en eski moderator devam eder
2. Önceden atanmış `designated_successor` varsa → ona devredilir (V1 opsiyonel)
3. `speaker` listesinde stage’e en erken çıkan uygun kullanıcı → yeni moderator olur
4. Uygun aday yoksa → oda kapanır

### Senin “2. konuşmacı mod olur” fikrinin profesyonel karşılığı
“Stage’e çıkış sırasına göre en uygun speaker, moderatör devri için adaydır.”

### Neden önemli?
- Oda sürekliliğini korur
- Kaosu önler
- Tartışmayı kesmez
- Kullanıcı güveni oluşturur

---

## 7.12 Oda Kapanışı
Oda aşağıdaki koşullarda sonlandırılır:
- Owner/moderator manuel kapatır
- Grace sonrası uygun moderatör adayı yoktur
- Oda tamamen boş kalır (idle timeout)
- Moderasyon zorlaması / sistem müdahalesi (V2+)

---

## 8) Debate’e Özel Tartışma Deneyimi (V1 ve Sonrası)

## 8.1 V1 (Serbest ama Moderasyon Destekli Oda)
İlk sürümde:
- rol bazlı düzen
- mic queue
- moderator kontrolü
- otomatik handover
ile sağlam bir temel kurulur.

Bu, ürünün teknik ve topluluk güvenilirliğini oluşturur.

## 8.2 V2+ (Yapılandırılmış Tartışma Modları)
Debate’in asıl güçlendiği katman.

### Örnek formatlar
- **Serbest tartışma** (open room)
- **1v1 münazara**
- **2v2 panel**
- **Uzman paneli + soru-cevap**
- **Moderatör kontrollü kürsü**
- **Turlu konuşma (timed turns)**

### Yapılandırılmış tartışma özellikleri (V2+)
- konuşma süreleri
- sıra motoru (turn engine)
- rebuttal turları
- audience Q&A bölümü
- tartışma başı/sonu oylama
- “ikna oldum” metriği

---

## 9) Ürünün Bilgi Mimarisi (Information Architecture)

## 9.1 Ana Navigasyon (Web V1)
- Hall / Ana Sayfa
- Arama
- Oda Oluştur
- Profilim
- Bildirimler (V1.5)
- Ayarlar

## 9.2 Oda Ekranı Bölümleri
1. Oda başlığı / kategori / dil
2. Moderator alanı
3. Konuşmacılar alanı (stage)
4. Dinleyiciler alanı (scroll list/grid)
5. Mikrofon talep butonu (listener için)
6. Moderator paneli (yalnızca yetkililer için)
7. Bağlantı/kalite göstergesi
8. Çıkış butonu

### Moderator panelinde (V1)
- bekleyen mikrofon talepleri
- dinleyiciler listesi
- davet et
- kabul / red
- mute / unmute
- kullanıcıyı stage’den indir
- mic request aç/kapat
- odayı kapat

---

## 10) Güvenlik ve Moderasyon (Trust & Safety)

Debate’in hedef alanı gereği moderasyon sonradan eklenen bir “opsiyon” olamaz.  
Bu, ürün çekirdeğidir.

## 10.1 V1 Moderasyon (İnsan Kontrollü, Güçlü Araçlar)
### Oda içi temel araçlar
- mute / unmute
- speaker’ı listener’a düşürme
- kullanıcıyı odadan çıkarma
- mic request kapatma
- oda kapatma
- role yönetimi (owner/moderator)

### Kullanıcı tarafı raporlama
- kullanıcıyı raporla (V1/V1.5)
- odayı raporla (V1.5)
- kısa kategori (hakaret, spam, taciz, tehdit vb.)

### Audit Log (çok önemli)
Tüm kritik moderasyon aksiyonları loglanmalıdır:
- kim kimi mute etti
- kim kimi stage’e aldı
- kim kimi çıkardı
- hangi timestamp’te
- hangi room içinde

Bu; itiraz, güven, destek ve kötüye kullanım analizi için gereklidir.

---

## 10.2 V2+ AI Destekli Moderasyon Hattı
### Amaç
Moderasyon ekiplerinin yükünü azaltmak, riskli odaları ve davranışları erken tespit etmek.

### Katmanlar
1. **STT (Speech-to-Text)**
2. **Transkript tabanlı risk skoru**
3. **Gerekirse ses tonu/duygu analiz sinyalleri**
4. **Moderator dashboard uyarıları**
5. **Event-driven enforcement (soft → hard)**

### Önemli ilke
İlk aşamalarda tam otomatik ban yerine:
- warning
- temporary mute
- moderator escalation
kullanmak daha güvenlidir (false positive riskini azaltır).

---

## 10.3 Gizlilik ve Mahremiyet
Sesli platformlar mahremiyet açısından hassastır.

### Temel prensipler
- Gereksiz ses kaydı tutmama (V1)
- Kayıt varsa kullanıcıya açık bildirme (V2+ replay)
- Veri minimizasyonu
- Erişim logları
- Güvenli token bazlı kimlik doğrulama
- Yetkisiz oda erişimini engelleme

### Özel oda yaklaşımı (V2+)
- Private odalarda daha yüksek gizlilik seçenekleri
- Gelişmiş şifreleme / policy seçenekleri
- Kayıt kapalı odalar

---

## 11) Keşif (Discovery) ve Feed Mantığı

## 11.1 V1 Discovery (Rule-based)
İlk sürümde ağır ML sistemlerine gerek yoktur.  
Basit ama etkili bir sıralama motoru yeterlidir.

### Oda skorunu etkileyen sinyaller
- anlık dinleyici sayısı
- son X dakikadaki büyüme hızı
- konuşmacı sayısı
- oda yaşı (çok eski odaları dengeleme)
- kategori eşleşmesi (kullanıcı ilgi alanı)
- rapor/şikayet oranı (negatif sinyal)
- takip edilen kişilerin odada olması (V1.5)

### Hedef
Kullanıcı Hall’e girdiğinde ilk 10-20 oda içinde ilgisini çekecek bir seçenek bulabilmeli.

---

## 11.2 V2+ Discovery (ML / Graph destekli)
İleri aşamada:
- sosyal grafik
- etkileşim grafiği
- odalarda kalma süresi
- konuşmacı kalitesi sinyalleri
- kategori eğilimi
ile daha kişiselleştirilmiş bir öneri sistemi kurulabilir.

### Olası teknolojik evrim
- grafik veritabanı (Neo4j / JanusGraph)
- event stream (Kafka/Redpanda)
- gerçek zamanlı feature hesaplama
- GBDT tabanlı ranking

---

## 12) Teknik Mimari Vizyonu (Yüksek Seviye)

> Bu dokümanın odağı ürün fikri olsa da, Debate’in başarısı teknik omurgaya doğrudan bağlıdır. Bu nedenle teknik mimari vizyonu ürün fikrinin bir parçasıdır.

## 12.1 Temel Realtime Ses Mimarisi
### Neden WebRTC?
Debate gerçek zamanlı etkileşim, söz alma, söz kesme, hızlı tepki gerektirir.  
Bu nedenle düşük gecikmeli **WebRTC** zorunludur.

### Neden SFU?
Mesh mimari küçük odalarda bile hızla çöker; MCU pahalı ve esnekliği düşük olur.  
**SFU**, modern sosyal ses/video platformları için en dengeli çözümdür:
- düşük gecikme
- iyi ölçeklenme
- düşük sunucu CPU maliyeti
- rol bazlı ses yönlendirme için uygun yapı

## 12.2 Önerilen V1 Teknik Stack (gerçekçi/profesyonel)
- **Realtime Media:** LiveKit (SFU tabanlı)
- **TURN/NAT Traversal:** Coturn
- **Backend API / Room Control:** Go (veya Node/NestJS)
- **Signaling:** WebSocket (stateless)
- **State Omurgası:** Redis (TTL destekli)
- **Kalıcı Veri:** PostgreSQL
- **Asset Storage:** S3 uyumlu object storage + CDN
- **Auth:** OAuth + Email + SMS OTP + JWT tabanlı session/token modeli

## 12.3 Neden “Stateless Signaling + Redis”?
Çünkü büyük odalarda:
- reconnect,
- ağ değişimi,
- pod restart,
- ölçekleme
durumlarında state’in node RAM’inde tutulması kırılganlık yaratır.

### Prensip
- WebSocket node’ları geçici bağlantı katmanı
- Room/presence/mic queue state → Redis
- Kalıcı kayıtlar → Postgres

Bu yaklaşım, moderatör devri ve oda sürekliliği gibi ürün özelliklerini güvenilir hale getirir.

---

## 12.4 Ölçeklenme Vizyonu (V2/V3)
Büyüdükçe şu katmanlar devreye alınır:
- bölgesel SFU dağıtımı
- cascading / hierarchical SFU
- büyük audience için hybrid distribution (WebRTC + HLS/CDN opsiyonu)
- transcript indexing
- AI moderation pipeline
- gelişmiş discovery/ranking engine
- observability ve autoscaling olgunlaşması

---

## 13) Oda Domain Modeli ve Yaşam Döngüsü (Konsept Düzeyi)

## 13.1 Oda Türleri (V1)
- `public`
- `private`

## 13.2 Oda Durumları (Room States)
- `creating`
- `live`
- `grace_waiting_for_owner`
- `transferring_moderation`
- `ended`
- `archived` (replay varsa, V2+)

## 13.3 Oda İçi Roller
- `owner_moderator`
- `moderator`
- `speaker`
- `listener`

## 13.4 Kritik Kurallar
- Odayı açan kullanıcı otomatik owner_moderator olur
- Katılan herkes başlangıçta listener’dır
- Speaker terfisi moderator onayı ile olur (invite veya mic request)
- Owner ayrıldığında grace period ve handover policy çalışır
- Halef yoksa oda kapanır

---

## 14) Edge Case Tasarımı (Profesyonellik Burada Belli Olur)

## 14.1 Owner internet kopması / refresh
- Oda hemen kapanmaz
- Grace period başlar
- Owner geri dönerse normal devam

## 14.2 Owner çıktı, speaker’lar var
- Grace sonrası uygun speaker mod olur
- Oda devam eder

## 14.3 Owner çıktı, sadece listener’lar var
- V1’de oda kapanır (daha temiz kural)
- V2’de mod teklif mekanizması eklenebilir

## 14.4 Yeni mod da çıkarsa
- Aynı handover algoritması tekrar çalışır
- Halef yoksa oda kapanır

## 14.5 Kullanıcı speaker oldu ama mikrofon izni yok
- Rol `speaker` olur ama `muted/no permission` olarak görünür
- UI mikrofon izni ister

## 14.6 Aynı kullanıcıya üst üste invite
- Tek aktif invite kuralı
- Duplicate request/invite engeli

## 14.7 Mic request kapalıyken pending talepler
- V1 yaklaşımı: yeni talep alma durur, mevcutlar moderatörce temizlenebilir
- Kural açık olmalı; belirsizlik olmamalı

---

## 15) Ürünün Sosyal Dinamikleri ve Topluluk Stratejisi

## 15.1 Debate’in başarısı sadece teknoloji değildir
Bu ürünün kaderi şu dengeye bağlıdır:
- ifade özgürlüğü
- topluluk güvenliği
- moderasyon kalitesi
- kullanıcı deneyimi
- keşif sistemi

## 15.2 Kaliteyi artıran ürün mekanizmaları (V2+)
- konu/tez zorunlu oda başlatma
- kategori etiketi zorunluluğu
- odalarda temel kurallar popup’ı
- moderatör rozetleri
- konuşmacı itibarı (reputation)
- “ikna oldum” oylaması
- tartışma sonrası özet / replay / clip

## 15.3 Toksisiteyi azaltan ürün mekanizmaları
- hızlı mute / kick
- mic request kapatma
- kullanıcı raporlama
- audit log
- risk sinyali dashboard
- repeat offender politikaları

---

## 16) İş Modeli (Monetization) — Vizyon Seviyesi

> İlk sürüm odak noktası ürün/çekirdek deneyim olmalı; monetization sonradan eklenmeli. Yine de fikir net olmalı.

## 16.1 Olası gelir modelleri
### A) Premium Moderatör / Creator Araçları (en doğal)
- gelişmiş oda yönetimi
- replay
- transcript
- analytics dashboard
- scheduled rooms
- branded room features

### B) Kurumsal / Topluluk paketleri
- düşünce kuruluşları
- üniversite kulüpleri
- medya kuruluşları
- uzman toplulukları

### C) Sponsorluk / Öne çıkarma (dikkatli)
- curated sponsor rooms
- etkinlik bazlı sponsorlu içerik
- spam reklam modelinden kaçınmak gerekir

### D) API / Social Listening (ileri aşama)
- kurumsal içgörü panelleri
- marka/topluluk analitiği

---

## 17) Başarı Metrikleri (North Star + KPI Seti)

## 17.1 North Star Metric (öneri)
**Haftalık nitelikli sesli etkileşim dakikası**  
(ör. moderasyon müdahalesi ile kaosa dönüşmemiş, belirli kalite sinyallerini geçen oda etkileşim süresi)

## 17.2 Ürün KPI’ları
### Aktivasyon
- kayıt → ilk oda girişi dönüşüm oranı
- kayıt → profil tamamlama oranı
- kayıt → ilk oda açma oranı

### Kullanım
- günlük/haftalık aktif kullanıcı
- kişi başı dinleme süresi
- kişi başı oda sayısı
- hall → oda tıklama oranı
- mic request gönderme oranı
- invite kabul oranı

### Oda Kalitesi
- oda başına ort. süre
- konuşmacı/dinleyici oranı
- moderasyon aksiyonu oranı
- oda kapanma sebebi dağılımı
- grace sonrası başarılı handover oranı

### Güvenlik
- raporlanan oda/kullanıcı oranı
- yanlış pozitif moderasyon oranı (V2+)
- repeat offender oranı

### Teknik
- join success rate
- reconnect success rate
- ortalama gecikme
- audio packet loss oranı
- TURN fallback oranı

---

## 18) MVP Kapsamı (Ne Var / Ne Yok)

## 18.1 MVP’de Olacaklar
- Google / X / Email / Phone auth
- profil (avatar + bio + kısa bilgiler)
- Hall / canlı odalar feed’i
- public/private oda oluşturma
- rol sistemi (owner mod / moderator / speaker / listener)
- konuşmacı daveti
- mic request queue
- mic request aç/kapat
- moderator handover (grace + successor)
- oda kapanma kuralları
- temel moderasyon (mute/kick)
- audit log (backend)
- WebRTC + SFU altyapısı
- Redis state omurgası
- Postgres kalıcı veriler

## 18.2 MVP’de Olmayacaklar (Bilinçli olarak)
- replay/kayıt
- transcript
- AI moderation
- structured debate timers/turn engine
- graph-based discovery
- ML recommendation
- large scale hybrid distribution (HLS)
- E2EE/SFrame (özel gelişmiş modlar)

---

## 19) V1 → V2 → V3 Yol Haritası (Ürün Evrimi)

## 19.1 V1 (Foundation)
Amaç: Çekirdek sesli oda deneyimini stabil ve güvenilir hale getirmek
- auth/profil/hall/oda
- rol + moderator handover
- mic queue
- temel moderasyon
- güçlü observability

## 19.2 V1.5 (Engagement & Governance)
Amaç: Kullanıcı kalitesini ve retention’ı artırmak
- scheduled rooms
- follow system
- notifications
- raporlama ekranı
- room rules
- co-moderator yönetimi
- basit analytics (creator için)

## 19.3 V2 (Debate Identity)
Amaç: Platformu “tartışma platformu” olarak net ayrıştırmak
- structured debate formats
- timer/turn engine
- audience Q&A
- oylama / “ikna oldum”
- transcript & replay (seçmeli)
- moderation dashboard
- discovery iyileştirmeleri

## 19.4 V3 (Scale & Intelligence)
Amaç: Büyük ölçek ve akıllı sistemler
- AI moderation pipeline
- gelişmiş discovery/ranking (ML)
- bölgesel/cascading SFU
- hybrid delivery options
- creator/enterprise analytics
- özel odalar için ileri güvenlik seçenekleri

---

## 20) Teknik ve Ürün Riskleri + Önleyici Stratejiler

## 20.1 Teknik Riskler
### Risk
Bağlantı sorunları, NAT/firewall, düşük join rate  
### Önlem
- güçlü TURN altyapısı (Coturn)
- fallback stratejileri
- telemetry ve hata analizi

### Risk
Oda state desync (mod kim, speaker kim)  
### Önlem
- stateless signaling
- Redis single source of truth (ephemeral state)
- event ordering/idempotency yaklaşımı

### Risk
Büyük odalarda performans düşüşü  
### Önlem
- konuşmacı limiti
- audience ölçek stratejisi
- kademeli altyapı evrimi

---

## 20.2 Ürün Riskleri
### Risk
Kaotik oda deneyimi → retention düşer  
### Önlem
- mic queue
- mod araçları
- role permissions
- handover policy

### Risk
Toksisite / güven kaybı  
### Önlem
- güçlü moderasyon araçları
- raporlama
- audit logs
- V2 AI moderation

### Risk
Hall’de keşif başarısızlığı  
### Önlem
- rule-based ranking
- kategori filtresi
- kullanıcı ilgi sinyalleri
- iteratif discovery geliştirmesi

---

## 21) Debate’in Marka ve Ürün Kimliği (Stratejik Not)

### İsim standardizasyonu
Dokümanlarda “Debade” ve “Debate” birlikte geçiyor.  
Bu, teknik ve operasyonel süreçlerde sorun yaratır:
- domain
- backend namespace
- repo yapısı
- app store listing
- sosyal medya handle
- marka tescili

**Öneri:** Tek isimde kilitlenin ve her yerde aynı yazımı kullanın.

### Marka vaadi (öneri)
“Sesli tartışmalar için düzenli, güvenli ve güçlü bir platform.”

---

## 22) Nihai Ürün Özeti (Executive Product Summary)

Debate, gerçek zamanlı sosyal ses deneyimini “oda açma” seviyesinden alıp “yönetilebilir, sürdürülebilir tartışma altyapısı” seviyesine taşıyan bir platform fikridir. Ürünün başarısı yalnızca sesli oda özelliğine değil; rol bazlı moderasyon, kullanıcı güvenliği, moderator handover sürekliliği, Hall/feed keşif sistemi ve ölçeklenebilir WebRTC+SFU mimarisine dayanır.

İlk sürümde hedef, hızlı ama kırılgan bir prototip değil; sade kapsamlı fakat güvenilir bir temel oluşturmaktır:
- kullanıcı hızlı kayıt olur,
- profilini düzenler,
- Hall’de odaları görür,
- odaya listener olarak katılır,
- moderatör konuşmacıları yönetir,
- mic queue adil çalışır,
- owner çıkarsa oda kaosa düşmez,
- sistem ölçeğe uygun şekilde state yönetir.

Bu temel üzerine gelecek yapılandırılmış münazara formatları, replay/transcript, AI moderation ve gelişmiş discovery katmanları eklendiğinde Debate, yalnızca bir sosyal ses uygulaması değil; dijital kamusal tartışma altyapısı haline gelebilir.

---

## 23) Ek: V1 İçin Kısa “Scope Freeze” Metni (Takım İçin)
> V1’in amacı tartışma deneyimini iskelet halinde ama sağlam şekilde kurmaktır. Bu sürümde odak; auth, profil, hall, oda lifecycle, roller, mic request, moderasyon devri ve temel moderasyon araçlarıdır. Replay, transcript, AI moderation, structured debate engine ve gelişmiş discovery sistemleri V2+ kapsamındadır. V1’in başarı kriteri; yüksek join success rate, stabil oda state yönetimi, düşük kaos oranı ve kullanıcıların düzenli sesli tartışma oturumlarını sürdürebilmesidir.

---