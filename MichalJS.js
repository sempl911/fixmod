(() => {

  let currentOrderId = null;
  let box = null;
  let updateTimeout = null;
  let scriptEnabled = true;

  // pobieramy stan z storage przy starcie
  chrome.storage.sync.get('qrScriptEnabled', data => {
    scriptEnabled = data.qrScriptEnabled !== false;
    if (scriptEnabled) checkOrder();
  });

  // reagowanie na wiadomości z popup
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'disable') {
      scriptEnabled = false;
      if (box) box.remove();
    } else if (msg.action === 'enable') {
      scriptEnabled = true;
      checkOrder();
    }
  });

  function createBox() {
    if (!scriptEnabled) return;
    if (box) return;

    const savedPos = JSON.parse(localStorage.getItem("qrBoxPosition") || "{}");
    let offsetX = savedPos.x || 20;
    let offsetY = savedPos.y || 20;

    box = document.createElement("div");
    box.id = "qr-box-fixed";
    box.style.position = "fixed";
    box.style.left = offsetX + "px";
    box.style.top = offsetY + "px";
    box.style.background = "#fff";
    box.style.padding = "10px";
    box.style.borderRadius = "8px";
    box.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
    box.style.zIndex = "999999";
    box.style.textAlign = "center";
    box.style.cursor = "move";

    const phoneText = document.createElement("div");
    phoneText.id = "qr-phone";
    phoneText.style.fontWeight = "bold";
    phoneText.style.fontSize = "16px";
    phoneText.style.color = "black";
    box.appendChild(phoneText);

    const imeiText = document.createElement("div");
    imeiText.id = "qr-imei";
    imeiText.style.marginBottom = "6px";
    imeiText.style.fontWeight = "normal";
    imeiText.style.fontSize = "20px";
    imeiText.style.color = "black";
    imeiText.style.cursor = "pointer";
    imeiText.title = "Copy";
    imeiText.addEventListener("click", () => {
      const imeiOrSn = getIMEIorSN();
      if (!imeiOrSn) return;
      navigator.clipboard.writeText(imeiOrSn).then(() => {
        const original = imeiText.innerText;
        imeiText.innerText = "Copied!";
        setTimeout(() => imeiText.innerText = original, 1000);
      }).catch(() => {
        const original = imeiText.innerText;
        imeiText.innerText = "Error";
        setTimeout(() => imeiText.innerText = original, 1000);
      });
    });
    box.appendChild(imeiText);

    const img = document.createElement("img");
    img.id = "qr-img";
    box.appendChild(img);

    const orderText = document.createElement("div");
    orderText.id = "qr-order";
    orderText.style.marginTop = "6px";
    orderText.style.fontWeight = "bold";
    orderText.style.fontSize = "28px";
    orderText.style.color = "black";
    orderText.style.cursor = "pointer";
    orderText.title = "Copy";
    orderText.addEventListener("click", () => {
      if (!currentOrderId) return;
      const original = currentOrderId;
      navigator.clipboard.writeText(currentOrderId)
        .then(() => {
          orderText.innerText = "Copied!";
          setTimeout(() => orderText.innerText = original, 1000);
        })
        .catch(() => {
          orderText.innerText = "Error!";
          setTimeout(() => orderText.innerText = original, 1000);
        });
    });
    box.appendChild(orderText);

    document.body.appendChild(box);

    // Drag
    let isDragging = false;
    let startX, startY;

    box.addEventListener("mousedown", e => {
      isDragging = true;
      startX = e.clientX - box.offsetLeft;
      startY = e.clientY - box.offsetTop;
      e.preventDefault();
    });

    document.addEventListener("mousemove", e => {
      if (!isDragging) return;
      let x = e.clientX - startX;
      let y = e.clientY - startY;
      x = Math.max(0, Math.min(window.innerWidth - box.offsetWidth, x));
      y = Math.max(0, Math.min(window.innerHeight - box.offsetHeight, y));
      box.style.left = x + "px";
      box.style.top = y + "px";
    });

    document.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      localStorage.setItem(
        "qrBoxPosition",
        JSON.stringify({ x: box.offsetLeft, y: box.offsetTop })
      );
    });
  }

  function updateBox(orderId, phoneName, imeiOrSn) {
    if (!scriptEnabled) return;
    createBox();
    document.getElementById("qr-img").src =
      `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(orderId)}`;
    document.getElementById("qr-order").innerText = `${orderId}`;
    document.getElementById("qr-phone").innerText = phoneName ? phoneName.slice(0,28) + (phoneName.length>28?"…":"") : "";
    document.getElementById("qr-imei").innerText = imeiOrSn ? imeiOrSn : "NO IMEI/SN";
  }

  function getPhoneName() {
    const deviceIcon = document.querySelector(".panel-heading h4 a i.fa-desktop");
    if (!deviceIcon) return "";
    const parentLink = deviceIcon.parentElement;
    for (let node of parentLink.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) return text;
      }
    }
    return "";
  }

  // imei lub sn
  function getIMEIorSN() {
    const dts = document.querySelectorAll("#device-panel dt");
    let serial = "";
    let imei = "";

    for (let dt of dts) {
      const label = dt.textContent.trim();
      const dd = dt.nextElementSibling;
      if (!dd) continue;

      // jeśli etykieta zawiera IMEI
      if (/IMEI/i.test(label)) {
        imei = dd.textContent.trim();
      }
      // jeśli etykieta zawiera Numer seryjny
      if (/Numer seryjny/i.test(label) || /Serial/i.test(label)) {
        serial = dd.textContent.trim();
      }
    }

    // jest imei daj imei
    if (imei) return imei;
    // nie ma imei jest serial daj serial
    if (serial) return serial;
    // nie ma nic zwroc pusty
    return "";
  }

  function checkOrder() {
    if (!scriptEnabled) return;
    const orderId = location.pathname.match(/orders\/(\d+)/)?.[1];
    if (!orderId) return;
    if (orderId !== currentOrderId) currentOrderId = orderId;
    const phoneName = getPhoneName();
    const imeiOrSn = getIMEIorSN();
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => updateBox(orderId, phoneName, imeiOrSn), 100);
  }

  // MutationObserver tylko dla panel-heading
  const container = document.querySelector(".panel-heading");
  if (container) {
    const observer = new MutationObserver(checkOrder);
    observer.observe(container, { childList: true, subtree: true });
  }

  // fallback co 1s
  setInterval(checkOrder, 1000);

  // pierwsze uruchomienie
  checkOrder();
})();