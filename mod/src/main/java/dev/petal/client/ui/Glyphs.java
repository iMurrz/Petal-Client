package dev.petal.client.ui;

import net.minecraft.client.gui.GuiGraphics;

/** 8×8 pixel icons for Petal's menus, drawn with plain fills so they follow any colour. */
public final class Glyphs {
    public static final String[] HOME = {"...##...", "..####..", ".######.", "########", ".#....#.", ".#.##.#.", ".#.##.#.", ".######."};
    public static final String[] SERVERS = {"########", "#......#", "#.#....#", "########", "########", "#......#", "#.#....#", "########"};
    public static final String[] CLOUD = {"........", "...##...", "..####..", ".######.", "########", "########", ".######.", "........"};
    public static final String[] SLIDERS = {"..#.....", "########", "..#.....", ".....#..", "########", ".....#..", ".#......", "########"};
    public static final String[] CAMERA = {"..###...", "########", "#..##..#", "#.#..#.#", "#.#..#.#", "#..##..#", "########", "........"};
    public static final String[] GRID = {"###.###.", "###.###.", "###.###.", "........", "###.###.", "###.###.", "###.###.", "........"};
    public static final String[] TROPHY = {"########", "#.####.#", "#.####.#", ".######.", "..####..", "...##...", "..####..", ".######."};
    public static final String[] CHART = {"......#.", "......#.", "...#..#.", "...#..#.", "#..#..#.", "#..#..#.", "#..#..#.", "########"};
    public static final String[] FRAME = {"##....##", "#......#", "...##...", "..####..", "..####..", "...##...", "#......#", "##....##"};
    public static final String[] LAN = {"..####..", "..#..#..", "..####..", "...##...", "########", "#..##..#", "#..##..#", "##.##.##"};
    public static final String[] GLOBE = {"..####..", ".#.##.#.", "#..##..#", "########", "#..##..#", "#..##..#", ".#.##.#.", "..####.."};
    public static final String[] PERSON = {"...##...", "...##...", "........", "########", "...##...", "...##...", "..#..#..", ".#....#."};
    public static final String[] PLAY = {".#......", ".###....", ".#####..", ".#######", ".#######", ".#####..", ".###....", ".#......"};
    public static final String[] DOOR = {"#####...", "#...#...", "#...#.#.", "#.#.####", "#...#.#.", "#...#...", "#...#...", "#####..."};
    public static final String[] MORE = {"........", "........", "........", "##.##.##", "##.##.##", "........", "........", "........"};
    public static final String[] CUBE = {"...##...", ".##..##.", "#......#", "##....##", "#.##.#.#", "#...##.#", ".##.#.#.", "...##..."};
    public static final String[] PACKS = {"..######", "..#....#", "######.#", "#....#.#", "#....###", "#....#..", "######..", "........"};
    public static final String[] CHEVRON = {"..#.....", "...#....", "....#...", ".....#..", ".....#..", "....#...", "...#....", "..#....."};

    private Glyphs() {}

    /** Draws `glyph` with its top-left at (x, y); each glyph pixel is `px` GUI pixels. */
    public static void draw(GuiGraphics g, String[] glyph, int x, int y, int px, int color) {
        for (int row = 0; row < glyph.length; row++) {
            String line = glyph[row];
            int start = -1;
            for (int col = 0; col <= line.length(); col++) {
                boolean on = col < line.length() && line.charAt(col) == '#';
                if (on && start < 0) start = col;
                if (!on && start >= 0) {
                    g.fill(x + start * px, y + row * px, x + col * px, y + (row + 1) * px, color);
                    start = -1;
                }
            }
        }
    }
}
