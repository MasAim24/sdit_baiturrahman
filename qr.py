"""QR Code byte mode, versions 1-4, error correction M."""

EXP = [0] * 512
LOG = [0] * 256
_x = 1
for _i in range(255):
    EXP[_i] = _x
    LOG[_x] = _i
    _x <<= 1
    if _x & 0x100:
        _x ^= 0x11D
for _i in range(255, 512):
    EXP[_i] = EXP[_i - 255]


def _mul(a, b):
    if a == 0 or b == 0:
        return 0
    return EXP[LOG[a] + LOG[b]]


def _generator(nsym):
    poly = [1]
    for i in range(nsym):
        nxt = [0] * (len(poly) + 1)
        for j, coef in enumerate(poly):
            nxt[j] ^= coef
            nxt[j + 1] ^= _mul(coef, EXP[i])
        poly = nxt
    return poly


def _rs(data, nsym):
    gen = _generator(nsym)
    msg = list(data) + [0] * nsym
    for i in range(len(data)):
        coef = msg[i]
        if coef:
            for j, g in enumerate(gen):
                msg[i + j] ^= _mul(g, coef)
    return msg[-nsym:]


# version: (size, data codewords at ECC M, ecc codewords)
# One block for these versions at level M.
VERSIONS = {
    1: (21, 16, 10),
    2: (25, 28, 16),
    3: (29, 44, 26),
    4: (33, 64, 36),
}


def _bits_for(text, version, data_len):
    raw = text.encode("iso-8859-1")
    bits = f"0100{len(raw):08b}"
    for byte in raw:
        bits += f"{byte:08b}"
    bits += "0000"
    bits += "0" * (8 - (len(bits) % 8))
    data = [int(bits[i : i + 8], 2) for i in range(0, len(bits), 8)]
    pad = 0xEC
    while len(data) < data_len:
        data.append(pad)
        pad = 0x11 if pad == 0xEC else 0xEC
    return data


def _blank(size):
    return [[None] * size for _ in range(size)]


def _finder(m, r, c):
    for dr in range(7):
        for dc in range(7):
            edge = dr in (0, 6) or dc in (0, 6) or (2 <= dr <= 4 and 2 <= dc <= 4)
            m[r + dr][c + dc] = edge
    for i in range(8):
        if r + i < len(m) and c - 1 >= 0:
            m[r + i][c - 1] = False
        if r + i < len(m) and c + 7 < len(m):
            m[r + i][c + 7] = False
        if c + i < len(m) and r - 1 >= 0:
            m[r - 1][c + i] = False
        if c + i < len(m) and r + 7 < len(m):
            m[r + 7][c + i] = False


def _reserve(version):
    size, _, _ = VERSIONS[version]
    m = _blank(size)
    _finder(m, 0, 0)
    _finder(m, 0, size - 7)
    _finder(m, size - 7, 0)
    for i in range(8, size - 8):
        m[6][i] = i % 2 == 0
        m[i][6] = i % 2 == 0
    m[size - 8][8] = True
    for i in range(9):
        if m[8][i] is None:
            m[8][i] = False
        if m[i][8] is None:
            m[i][8] = False
    for i in range(8):
        if m[8][size - 1 - i] is None:
            m[8][size - 1 - i] = False
        if m[size - 1 - i][8] is None:
            m[size - 1 - i][8] = False
    if version >= 2:
        centers = {2: [6, 18], 3: [6, 22], 4: [6, 26]}[version]
        for r in centers:
            for c in centers:
                if m[r][c] is not None:
                    continue
                for dr in range(-2, 3):
                    for dc in range(-2, 3):
                        edge = max(abs(dr), abs(dc)) != 1
                        m[r + dr][c + dc] = edge
    return m


def _format_bits(mask):
    # ECC M is 00
    data = mask
    rem = data << 10
    for i in range(4, -1, -1):
        if rem & (1 << (i + 10)):
            rem ^= 0x537 << i
    return ((data << 10) | rem) ^ 0x5412


def _apply_format(m, mask):
    bits = _format_bits(mask)
    size = len(m)
    positions = []
    for i in range(8):
        positions.append((8, size - 1 - i))
    for i in range(7):
        positions.append((size - 1 - i, 8))
    coords = [
        (8, 0), (8, 1), (8, 2), (8, 3), (8, 4), (8, 5), (8, 7), (8, 8),
        (7, 8), (5, 8), (4, 8), (3, 8), (2, 8), (1, 8), (0, 8),
    ]
    # The 15 bits are placed in a defined order. Rebuild explicitly.
    order_a = [(8, 0), (8, 1), (8, 2), (8, 3), (8, 4), (8, 5), (8, 7), (8, 8),
               (7, 8), (5, 8), (4, 8), (3, 8), (2, 8), (1, 8), (0, 8)]
    order_b = [(size - 1, 8), (size - 2, 8), (size - 3, 8), (size - 4, 8),
               (size - 5, 8), (size - 6, 8), (size - 7, 8),
               (8, size - 8), (8, size - 7), (8, size - 6), (8, size - 5),
               (8, size - 4), (8, size - 3), (8, size - 2), (8, size - 1)]
    for i in range(15):
        bit = bool((bits >> (14 - i)) & 1)
        r, c = order_a[i]
        m[r][c] = bit
        r, c = order_b[i]
        m[r][c] = bit


def _place(reserved, data_bits):
    size = len(reserved)
    m = [row[:] for row in reserved]
    idx = 0
    for right in range(size - 1, 0, -2):
        if right <= 6:
            right -= 1
        for vertical in range(size):
            for z in range(2):
                j = right - z
                upwards = (right & 2) == 0
                upwards ^= j < 6
                i = (size - 1 - vertical) if upwards else vertical
                if m[i][j] is None:
                    m[i][j] = data_bits[idx] == "1" if idx < len(data_bits) else False
                    idx += 1
    return m


def _mask_func(mask, r, c):
    if mask == 0:
        return (r + c) % 2 == 0
    if mask == 1:
        return r % 2 == 0
    if mask == 2:
        return c % 3 == 0
    if mask == 3:
        return (r + c) % 3 == 0
    if mask == 4:
        return (r // 2 + c // 3) % 2 == 0
    if mask == 5:
        return (r * c) % 2 + (r * c) % 3 == 0
    if mask == 6:
        return ((r * c) % 2 + (r * c) % 3) % 2 == 0
    return ((r + c) % 2 + (r * c) % 3) % 2 == 0


def _apply_mask(matrix, reserved, mask):
    size = len(matrix)
    out = [row[:] for row in matrix]
    for r in range(size):
        for c in range(size):
            if reserved[r][c] is None and _mask_func(mask, r, c):
                out[r][c] = not out[r][c]
    return out


def _penalty(m):
    size = len(m)
    score = 0
    for row in m:
        run = 1
        for c in range(1, size):
            if row[c] == row[c - 1]:
                run += 1
                if run == 5:
                    score += 3
                elif run > 5:
                    score += 1
            else:
                run = 1
    for c in range(size):
        run = 1
        for r in range(1, size):
            if m[r][c] == m[r - 1][c]:
                run += 1
                if run == 5:
                    score += 3
                elif run > 5:
                    score += 1
            else:
                run = 1
    for r in range(size - 1):
        for c in range(size - 1):
            if m[r][c] == m[r][c + 1] == m[r + 1][c] == m[r + 1][c + 1]:
                score += 3
    finder = "10111010000"
    finder_rev = finder[::-1]
    for row in m:
        s = "".join("1" if v else "0" for v in row)
        score += 40 * (s.count(finder) + s.count(finder_rev))
    for c in range(size):
        s = "".join("1" if m[r][c] else "0" for r in range(size))
        score += 40 * (s.count(finder) + s.count(finder_rev))
    dark = sum(sum(1 for v in row if v) for row in m)
    percent = dark * 100 // (size * size)
    score += abs(percent - 50) // 5 * 10
    return score


def matrix(text):
    raw = text.encode("iso-8859-1")
    version = None
    for ver, (_, data_len, _) in VERSIONS.items():
        # 4 mode + 8 count + 8*len + 4 terminator
        if 16 + 8 * len(raw) <= data_len * 8:
            version = ver
            break
    if version is None:
        raise ValueError("Teks QR terlalu panjang")
    size, data_len, ecc_len = VERSIONS[version]
    data = _bits_for(text, version, data_len)
    ecc = _rs(data, ecc_len)
    bits = "".join(f"{b:08b}" for b in data + ecc)
    reserved = _reserve(version)
    placed = _place(reserved, bits)
    best = None
    best_score = None
    for mask in range(8):
        masked = _apply_mask(placed, reserved, mask)
        _apply_format(masked, mask)
        score = _penalty(masked)
        if best_score is None or score < best_score:
            best = masked
            best_score = score
    return best


def svg(text):
    m = matrix(text)
    n = len(m)
    quiet = 4
    size = n + quiet * 2
    parts = [f'<svg class="qr" viewBox="0 0 {size} {size}" role="img" aria-label="QR {text}">']
    parts.append(f'<rect width="{size}" height="{size}" fill="#fff"/>')
    for r, row in enumerate(m):
        for c, on in enumerate(row):
            if on:
                parts.append(f'<rect x="{c + quiet}" y="{r + quiet}" width="1" height="1" fill="#14241c"/>')
    parts.append("</svg>")
    return "".join(parts)
