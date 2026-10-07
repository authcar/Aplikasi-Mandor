import pygame
import random
import math

pygame.init()

WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Runaway Blob")
clock = pygame.time.Clock()

FONT = pygame.font.SysFont("consolas", 28)
BIG_FONT = pygame.font.SysFont("consolas", 56)

BG_COLOR = (18, 18, 28)
BLOB_COLOR = (255, 90, 90)
GOOD_COLOR = (90, 220, 130)
TEXT_COLOR = (240, 240, 240)

RUN_RADIUS = 160      # jarak mulai kabur dari cursor
BLOB_SPEED = 6.5
BLOB_SIZE = 22

GOOD_SIZE = 14
GOOD_SPAWN_MS = 1500


class Blob:
    def __init__(self):
        self.respawn()

    def respawn(self):
        margin = 60
        self.x = random.randint(margin, WIDTH - margin)
        self.y = random.randint(margin, HEIGHT - margin)

    def update(self, mx, my):
        dx = self.x - mx
        dy = self.y - my
        dist = math.hypot(dx, dy) or 1

        if dist < RUN_RADIUS:
            # makin dekat cursor, makin kencang kabur
            strength = (RUN_RADIUS - dist) / RUN_RADIUS
            speed = BLOB_SPEED * (0.5 + strength * 1.5)
            self.x += (dx / dist) * speed
            self.y += (dy / dist) * speed

        # pantul dari tepi layar
        self.x = max(BLOB_SIZE, min(WIDTH - BLOB_SIZE, self.x))
        self.y = max(BLOB_SIZE, min(HEIGHT - BLOB_SIZE, self.y))

    def draw(self, surf):
        pygame.draw.circle(surf, BLOB_COLOR, (int(self.x), int(self.y)), BLOB_SIZE)
        # mata simpel biar lucu
        pygame.draw.circle(surf, (255, 255, 255), (int(self.x - 7), int(self.y - 5)), 5)
        pygame.draw.circle(surf, (255, 255, 255), (int(self.x + 7), int(self.y - 5)), 5)
        pygame.draw.circle(surf, (0, 0, 0), (int(self.x - 7), int(self.y - 5)), 2)
        pygame.draw.circle(surf, (0, 0, 0), (int(self.x + 7), int(self.y - 5)), 2)


class GoodOrb:
    """Orb diam yang harus disentuh cursor untuk dapat skor bonus."""

    def __init__(self):
        margin = 40
        self.x = random.randint(margin, WIDTH - margin)
        self.y = random.randint(margin, HEIGHT - margin)

    def draw(self, surf):
        pygame.draw.circle(surf, GOOD_COLOR, (int(self.x), int(self.y)), GOOD_SIZE)


def draw_text_center(surf, text, font, color, y):
    render = font.render(text, True, color)
    rect = render.get_rect(center=(WIDTH // 2, y))
    surf.blit(render, rect)


def main():
    blob = Blob()
    good_orbs = []
    last_good_spawn = pygame.time.get_ticks()

    survival_ms = 0
    score = 0
    game_over = False

    pygame.mouse.set_visible(True)

    running = True
    while running:
        dt = clock.tick(60)
        mx, my = pygame.mouse.get_pos()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
                if event.key == pygame.K_r and game_over:
                    blob = Blob()
                    good_orbs.clear()
                    survival_ms = 0
                    score = 0
                    game_over = False

        if not game_over:
            blob.update(mx, my)

            # cek nyentuh blob = kalah
            if math.hypot(blob.x - mx, blob.y - my) < BLOB_SIZE:
                game_over = True

            # spawn good orb secara berkala
            now = pygame.time.get_ticks()
            if now - last_good_spawn > GOOD_SPAWN_MS and len(good_orbs) < 4:
                good_orbs.append(GoodOrb())
                last_good_spawn = now

            # cek ambil good orb
            for orb in good_orbs[:]:
                if math.hypot(orb.x - mx, orb.y - my) < GOOD_SIZE + 8:
                    good_orbs.remove(orb)
                    score += 50

            survival_ms += dt
            score_from_time = survival_ms // 100
            total_score = int(score_from_time) + score

        screen.fill(BG_COLOR)

        for orb in good_orbs:
            orb.draw(screen)
        blob.draw(screen)

        # cursor kecil
        pygame.draw.circle(screen, (255, 255, 255), (mx, my), 4)

        if not game_over:
            hud = FONT.render(f"Skor: {total_score}   Waktu: {survival_ms // 1000}s", True, TEXT_COLOR)
            screen.blit(hud, (12, 10))
        else:
            draw_text_center(screen, "GAME OVER", BIG_FONT, (255, 80, 80), HEIGHT // 2 - 40)
            draw_text_center(screen, f"Skor akhir: {total_score}", FONT, TEXT_COLOR, HEIGHT // 2 + 20)
            draw_text_center(screen, "Tekan R untuk main lagi, ESC untuk keluar", FONT, TEXT_COLOR, HEIGHT // 2 + 60)

        pygame.display.flip()

    pygame.quit()


if __name__ == "__main__":
    main()
